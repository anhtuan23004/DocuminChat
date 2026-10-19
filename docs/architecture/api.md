# API v1 và contract UI

OpenAPI đang chạy: `http://127.0.0.1:8000/docs`. UI gọi cùng origin `/api/v1`
qua Nginx. Backend giữ API key inference; frontend không gọi trực tiếp Colab.

| Method / path | Input | Output |
| --- | --- | --- |
| GET `/health` | — | status, auth, model_configured, retrieval, ocr |
| GET `/projects` | offset=0, limit=100 (max200) | `{items: [{id,name,created_at}]}` |
| POST `/projects` | `{name}` | 201 Project metadata |
| GET `/projects/{id}` | — | Project metadata |
| GET `/sessions` | project_id hoặc unassigned=true; archived=false; q?; include_archived=false; offset=0, limit=50 (max100) | `{items: [Session metadata]}` |
| POST `/sessions` | `{title?,project_id?:UUID|null}` | 201 Session metadata |
| GET `/sessions/{id}` | — | Session metadata cho reload/deep link |
| PATCH `/sessions/{id}` | `{title?:string,pinned?:bool,archived?:bool,project_id?:UUID|null}` | Session metadata đã lưu |
| GET `/sessions/{id}/messages` | offset=0, limit=100 (max200) | `{items: [{id,role,content,status,sources,created_at}]}` |
| POST `/sessions/{id}/messages` | `{content,document_ids?:UUID[],request_id:UUID}` | SSE |
| GET `/documents` | đúng một project_id hoặc session_id; offset=0, limit=100 (max200) | `{items: [{id,name,version,status,job_id,error,bindings}]}` |
| POST `/documents` | multipart file + đúng một project_id hoặc session_id | 202 document và binding; pending/processing/ready/failed |
| DELETE `/document-bindings/{id}` | — | 204; gỡ file tại một Project/session |
| GET `/jobs/{id}` | — | id, document_id, status, attempts, error |
| GET `/sources/{chunk_id}` | — | chunk_id, document_id, version, name, page, text |

Queries tối đa 4.000 ký tự, 20 tài liệu/request. Cùng nội dung upload có
checksum trùng theo owner → trả cùng document/job, kể cả job đang failed.
Version hiện tại = 1; chưa có mutate/reindex API.

## Scope Project và session

GET sessions có `q` tối đa200 ký tự: tìm substring trong title/messages đã
lưu, escape wildcard và giữ owner/filter Project nếu có. `include_archived=true`
trả cả active/archived, dùng cho global search. Output vẫn chỉ là metadata,
không tải toàn bộ messages về browser. Đây chưa phải full-text index.
PATCH title trim khoảng trắng, không nhận tên rỗng, tối đa120 ký tự.

Upload/list file bắt buộc chọn đúng một nơi lưu. File Project được kế thừa
trong tất cả sessions thuộc Project; file session chỉ thuộc hội thoại đó.
List session trả cả file riêng và file Project, mỗi document xuất hiện một
lần. `bindings` chỉ chứa liên kết phù hợp với context đang yêu cầu.

`document_ids` bỏ qua hoặc null khi gửi chat → tự lấy các file ready trong
scope, tối đa20 file được upload gần nhất; `[]` → không dùng tài liệu. List cụ thể phải thuộc session
hoặc Project cha. Backend kiểm tra scope trước lượt chat và khi retrieval;
file của chat khác bị từ chối dù có cùng owner. UI chọn tối đa20 file ready.

PATCH project_id chuyển chat sang Project mới; null đưa về hội thoại riêng.
Transcript và file riêng giữ nguyên, file Project được kế thừa thay đổi.
Một turn đang chạy sẽ chặn chuyển Project bằng409. DELETE binding chỉ gỡ
liên kết ở nơi đó, giữ chunks/file gốc, bindings khác và nguồn trong history.
Chi tiết schema và migration: [Project/session files](projects-and-files.md).

Errors trước stream dùng HTTP 404 (không tìm thấy/không sở hữu), 409 (busy,
request ID xung đột, tài liệu chưa ready), 413 (quá lớn), 422 (validation),
503 (model chưa cấu hình). Payload lỗi FastAPI `{detail: string|array}`.

## Streaming qua POST fetch

```text
event: sources
data: {"items":[{"chunk_id":"...","document_id":"...","version":1,"name":"file.pdf","page":1,"text":"..."}]}

event: delta
data: {"text":"Nội dung trả lời"}

event: done
data: {"message_id":"...","request_id":"..."}

```

Nếu lỗi giữa stream: `event: error` có `{code,message,request_id}`; không có
`done`. EOF thiếu `done` là failed. Chỉ phát `done` sau khi commit assistant
message thành công. Frontend dùng TextDecoder incremental, chịu frame/UTF-8
bị chia nhỏ; đổi hội thoại abort request và invalidate kết quả cũ.

Cùng session + request_id + nội dung đã hoàn tất → replay persisted result,
không gọi model lần hai. Cùng request ID nhưng payload khác → 409. Request
running/failed không tự chạy lại; request mới cần UUID mới. Một session có
một active turn với deadline; publish trễ không ghi đè lượt mới.

Abort dừng HTTP client/provider stream theo đường cancellation; chưa đảm
bảo GPU phía remote dừng compute. Partial answer lưu `status=failed`, không
được dùng như completed assistant history. UI không tự resend model request.

Local identity là server constant, không lấy owner từ browser. Mỗi đọc
document/job/source/session đều kiểm tra owner; đây chưa phải hệ thống
authentication cho nhiều người. Compose bind loopback và API chặn mutating
requests có Origin lạ.

Session metadata có `id`, `title`, `project_id`, `created_at`, `updated_at`, `pinned`, `archived`.
GET sessions có filter `archived=false` mặc định; `archived=true` xem phần
lưu trữ. Pinned được xếp trước, rồi updated_at. Archive không xóa messages;
khôi phục bằng PATCH archived=false. Không gửi chat vào archived session.
Revision0002 thêm pin/archive; revision0003 thêm Project và file bindings.
Baseline revision0001 giữ nguyên.
