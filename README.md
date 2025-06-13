# DocuminChat - Multi-Format Document Query System

DocuminChat is an advanced application that allows you to upload and query data from various file formats including CSV, XLSX, JSON, and PDF. The application leverages language models and embeddings to provide conversational querying capabilities. It processes the uploaded documents, splits them into manageable chunks, generates embeddings, and enables users to ask questions about the data. Built using Streamlit, LangChain, Hugging Face, and various NLP techniques, DocuminChat offers a seamless and interactive experience for data exploration.

## Features

- **Multi-Format Support**: Upload and process files in CSV, XLSX, JSON, and PDF formats.
- **Data Chunking**: Split data into manageable chunks for efficient processing.
- **Embeddings Generation**: Create embeddings from the data using pre-trained models.
- **Conversational AI**: Use advanced conversational AI models to answer questions based on the uploaded data.
- **Paginated Data View**: View data in a paginated format for better readability and navigation.

## Diagram

![Image](https://github.com/user-attachments/assets/8d56a16a-f599-4d9d-b92a-f0a61ca87342)

## Installation

### 1. Clone the repository or download the code.
```bash
git clone <repository_url>
cd <project_directory>
```

### 2. Set up a virtual environment (optional but recommended).
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows use venv\Scripts\activate
```

### 3. Install dependencies from requirements.txt.
Make sure `requirements.txt` is in the project directory.
```bash
pip install -r requirements.txt
```

### 4. Install Model
Follow the instructions in the `models` folder to install the necessary models.

## Usage

### 1. Start the Application
After installing all dependencies and setting up the environment, you can run the application using Streamlit:
```bash
streamlit run app.py
```

### 2. Upload a File
- Click the "Upload a File" button to select and upload your file (CSV, XLSX, JSON, or PDF).
- The data will be loaded, split into chunks, and the app will show a paginated view of the data.

### 3. Ask a Question
- Once the data is uploaded, you can type a question in the text box.
- Press the "Submit" button to get the answer based on the uploaded data.

### 4. Pagination
- The data is displayed in pages to avoid overwhelming the user with too much information at once.
- Use the page selector to view different parts of the data.

## Supported File Formats

- **CSV**: Comma-separated values file.
- **XLSX**: Microsoft Excel file.
- **JSON**: JavaScript Object Notation file.
- **PDF**: Portable Document Format file.

## Example Queries

- **For CSV/XLSX**: "What is the average value in column X?"
- **For JSON**: "What are the keys in the JSON object?"
- **For PDF**: "Summarize the content on page 5."

## Acknowledgments

- **Streamlit** for the interactive web application framework.
- **LangChain** for the language model integration.
- **Hugging Face** for the pre-trained models and embeddings.
- **Pandas** for data manipulation and analysis.

---

Enjoy exploring your data with DocumentChat! For any questions or support, please refer to the documentation or reach out to the maintainers.
