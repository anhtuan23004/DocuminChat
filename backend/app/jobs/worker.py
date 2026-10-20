import logging
import multiprocessing
import time
from datetime import timedelta

from sqlalchemy import delete, or_, select, update

from app.config import Settings
from app.documents.ingest import extract
from app.storage import Chunk, Document, Job, database, identifier, now

log = logging.getLogger(__name__)
LEASE_SECONDS = 120


def eligible():
    return or_(Job.status == "pending", (Job.status == "processing") & (Job.lease_until < now()))


def claim(factory):
    with factory() as db:
        job = db.scalar(select(Job).where(eligible()).order_by(Job.id).limit(1))
        if not job:
            return None
        token = identifier()
        result = db.execute(
            update(Job)
            .execution_options(synchronize_session="fetch")
            .where(Job.id == job.id, eligible())
            .values(
                status="processing",
                lease_token=token,
                lease_until=now() + timedelta(seconds=LEASE_SECONDS),
                attempts=Job.attempts + 1,
            )
        )
        if not result.rowcount:
            db.rollback()
            return None
        doc = db.get(Document, job.document_id)
        doc.status = "processing"
        db.commit()
        return {
            "id": job.id,
            "document_id": doc.id,
            "path": doc.path,
            "token": token,
            "attempts": job.attempts,
        }


def publish(factory, lease, chunks, error):
    with factory() as db:
        result = db.execute(
            update(Job)
            .where(
                Job.id == lease["id"],
                Job.lease_token == lease["token"],
                Job.status == "processing",
                Job.lease_until > now(),
            )
            .values(
                status="failed" if error else "completed",
                error=error,
                lease_token=None,
                lease_until=None,
            )
        )
        if not result.rowcount:
            db.rollback()
            return False
        db.execute(delete(Chunk).where(Chunk.document_id == lease["document_id"]))
        if not error:
            db.add_all(
                Chunk(document_id=lease["document_id"], page=page, text=text)
                for page, text in chunks
            )
        doc = db.get(Document, lease["document_id"])
        doc.status = "failed" if error else "ready"
        db.commit()
        return True


def parse_child(path, connection):
    try:
        connection.send((extract(path), None))
    except ValueError as error:
        connection.send(([], str(error)))
    except Exception:
        log.exception("Document parser failed")
        connection.send(([], "Không thể đọc tài liệu. Kiểm tra PDF hoặc UTF-8 của file TXT."))
    finally:
        connection.close()


def process_one(settings, factory):
    lease = claim(factory)
    if not lease:
        return False
    if lease["attempts"] > 3:
        publish(factory, lease, [], "Worker đã gián đoạn quá 3 lần; hãy kiểm tra tài liệu.")
        return True
    # Child process gives a hard extraction deadline without blocking the worker indefinitely.
    context = multiprocessing.get_context("spawn")
    receiver, sender = context.Pipe(duplex=False)
    child = context.Process(target=parse_child, args=(lease["path"], sender))
    child.start()
    sender.close()
    try:
        if receiver.poll(60):
            try:
                chunks, error = receiver.recv()
            except EOFError:
                chunks, error = [], "Tiến trình đọc tài liệu bị gián đoạn."
        else:
            chunks, error = [], "Xử lý tài liệu vượt quá 60 giây."
    finally:
        if child.is_alive():
            child.terminate()
        child.join(timeout=5)
        receiver.close()
    publish(factory, lease, chunks, error)
    return True


def main():
    logging.basicConfig(level=logging.INFO)
    settings = Settings()
    settings.validate()
    engine, factory = database(settings)
    try:
        while True:
            if not process_one(settings, factory):
                time.sleep(1)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
