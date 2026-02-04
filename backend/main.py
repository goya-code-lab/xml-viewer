import os
import shutil
import tempfile
import zipfile
import re
import asyncio
import time
from pathlib import Path
from typing import List, Optional, Dict
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from lxml import etree
from contextlib import asynccontextmanager

# セッション管理用のルートディレクトリ
BASE_TEMP_DIR = Path(tempfile.gettempdir()) / "xmlview3_sessions"
if BASE_TEMP_DIR.exists():
    try:
        shutil.rmtree(BASE_TEMP_DIR)
    except Exception:
        pass
BASE_TEMP_DIR.mkdir(parents=True, exist_ok=True)

sessions: Dict[str, Path] = {}
CLEANUP_THRESHOLD_SECONDS = 2 * 3600 # 2時間
CLEANUP_INTERVAL_SECONDS = 3600 # 1時間

async def cleanup_old_sessions():
    """古いセッションフォルダを定期的に削除するバックグラウンドタスク"""
    while True:
        try:
            current_time = time.time()
            session_ids_to_remove = []
            
            # 各セッションディレクトリの更新日時をチェック
            for session_id, session_dir in list(sessions.items()):
                if session_dir.exists():
                    mtime = session_dir.stat().st_mtime
                    if current_time - mtime > CLEANUP_THRESHOLD_SECONDS:
                        print(f"Cleaning up old session: {session_id}")
                        try:
                            shutil.rmtree(session_dir)
                        except Exception as e:
                            print(f"Failed to remove {session_dir}: {e}")
                        session_ids_to_remove.append(session_id)
                else:
                    session_ids_to_remove.append(session_id)
            
            # 辞書から削除
            for sid in session_ids_to_remove:
                if sid in sessions:
                    del sessions[sid]
                    
        except Exception as e:
            print(f"Error during cleanup: {e}")
            
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # アプリケーション起動時の処理
    asyncio.create_task(cleanup_old_sessions())
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静的ファイルを一括で配信
app.mount("/static", StaticFiles(directory=str(BASE_TEMP_DIR)), name="static")

def get_session_dir(session_id: str) -> Path:
    if session_id not in sessions:
        session_dir = BASE_TEMP_DIR / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        sessions[session_id] = session_dir
    return sessions[session_id]

def detect_xsl_path(xml_path: Path) -> Optional[Path]:
    try:
        with open(xml_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        pattern = r'<\?xml-stylesheet\s+[^?]*href=["\']([^"\']+)["\'][^?]*\?>'
        match = re.search(pattern, content, re.IGNORECASE)
        
        if match:
            xsl_filename = match.group(1)
            xsl_name_only = Path(xsl_filename).name
            xsl_path = xml_path.parent / xsl_name_only
            if xsl_path.exists() and xsl_path.is_file():
                return xsl_path
    except Exception:
        pass
    return None

@app.post("/upload/{session_id}")
async def upload_files(session_id: str, files: List[UploadFile] = File(...)):
    session_dir = get_session_dir(session_id)
    
    # 既存ファイルをクリア（セッション再利用時のため）
    for item in session_dir.iterdir():
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()
            
    for file in files:
        file_path = session_dir / file.filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        if file.filename.lower().endswith(".zip"):
            try:
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    zip_ref.extractall(session_dir)
                file_path.unlink()
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to extract ZIP {file.filename}: {str(e)}")
            
    xml_files = []
    for p in session_dir.rglob("*.xml"):
        xsl_path = detect_xsl_path(p)
        xml_files.append({
            "name": p.name,
            "path": str(p.relative_to(session_dir)),
            "has_xsl": xsl_path is not None and xsl_path.exists()
        })
        
    if not xml_files:
        raise HTTPException(status_code=400, detail="XMLファイルが見つかりませんでした。ZIPまたはフォルダ内にXMLが含まれているか確認してください。")
        
    return {"message": "Files uploaded successfully", "files": sorted(xml_files, key=lambda x: x["name"])}

@app.get("/view/{session_id}/{file_path:path}")
async def view_xml(session_id: str, file_path: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    full_path = sessions[session_id] / file_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(path=str(full_path), media_type="application/xml")

@app.get("/view_wrapped/{session_id}/{path:path}")
async def view_wrapped(session_id: str, path: str):
    if session_id not in sessions:
        return HTMLResponse(content="<html><body><h1>Session Expired</h1><p>Please re-upload your files.</p></body></html>", status_code=404)
        
    content_url = f"/static/{session_id}/{path}?t={int(time.time())}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>XML Preview - {path.split('/')[-1]}</title>
        <style>
            body, html {{
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f8fafc;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }}
            .header {{
                height: 60px;
                background: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 1rem;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 1000;
            }}
            @media (min-width: 768px) {{
                .header {{ padding: 0 2rem; }}
            }}
            .title {{
                font-weight: bold;
                color: #0c4a6e;
                font-size: 1rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 40%;
            }}
            @media (min-width: 768px) {{
                .title {{ font-size: 1.1rem; max-width: 50%; }}
            }}
            .controls {{
                display: flex;
                gap: 0.5rem;
            }}
            @media (min-width: 768px) {{
                .controls {{ gap: 1rem; }}
            }}
            button {{
                padding: 0.5rem 0.8rem;
                border-radius: 8px;
                border: none;
                font-weight: 600;
                font-size: 0.85rem;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 0.4rem;
            }}
            @media (min-width: 768px) {{
                button {{ padding: 0.6rem 1.2rem; font-size: 0.9rem; gap: 0.5rem; }}
            }}
            .btn-print {{
                background-color: #0284c7;
                color: white;
            }}
            .btn-print span {{ display: none; }}
            @media (min-width: 768px) {{ .btn-print span {{ display: inline; }} }}
            .btn-print:hover {{
                background-color: #0369a1;
            }}
            .btn-close {{
                background-color: #f1f5f9;
                color: #475569;
            }}
            .btn-close:hover {{
                background-color: #e2e8f0;
            }}
            .document-container {{
                flex: 1;
                overflow: auto;
                -webkit-overflow-scrolling: touch;
                background-color: #ffffff;
                padding: 0;
            }}
            iframe {{
                width: 100%;
                min-width: 100%;
                min-height: calc(100vh - 80px);
                border: none;
                background: white;
                display: block;
            }}
            @media print {{
                body {{ display: none !important; }}
            }}
        </style>
        <script>
            function triggerPrint() {{
                const iframe = document.querySelector('iframe');
                if (iframe) {{
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                }}
            }}

            function resizeIframe() {{
                const iframe = document.querySelector('iframe');
                if (iframe && iframe.contentWindow && iframe.contentWindow.document.body) {{
                    const doc = iframe.contentWindow.document;
                    const height = doc.documentElement.scrollHeight || doc.body.scrollHeight;
                    const width = doc.documentElement.scrollWidth || doc.body.scrollWidth;
                    
                    iframe.style.height = height + 'px';
                    
                    // Only expand width if content is wider than container
                    const containerWidth = document.querySelector('.document-container').clientWidth;
                    if (width > containerWidth) {{
                        iframe.style.width = width + 'px';
                    }} else {{
                        iframe.style.width = '100%';
                    }}
                }}
            }}

            window.addEventListener('load', () => {{
                const iframe = document.querySelector('iframe');
                if (iframe) {{
                    iframe.addEventListener('load', resizeIframe);
                    setInterval(resizeIframe, 500);
                }}
            }});
        </script>
    </head>
    <body>
        <div class="header">
            <div class="title">{path.split('/')[-1]}</div>
            <div class="controls">
                <button class="btn-print" onclick="triggerPrint()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    <span>印刷 / PDF</span>
                </button>
                <button class="btn-close" onclick="window.close()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    <span>閉じる</span>
                </button>
            </div>
        </div>
        <div class="document-container">
            <iframe src="{content_url}" scrolling="no"></iframe>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
