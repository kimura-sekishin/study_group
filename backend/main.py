import os
import time
import jwt
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# --- CORS設定 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kimura-sekishin.github.io"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 環境変数 ---
SKYWAY_APP_ID = os.environ.get("SKYWAY_APP_ID")
SKYWAY_SECRET_KEY = os.environ.get("SKYWAY_SECRET_KEY")
APP_PASSWORD = os.environ.get("APP_PASSWORD", "default_pass")

# --- 履歴保存用メモリ ---
join_logs = []


# 1. ヘルスチェック用（Renderのデプロイ成功率を上げます）
@app.get("/")
def read_root():
    return {"status": "ok", "message": "SkyWay Token Server is running"}


# 2. 履歴確認用（デバッグ時にも便利です）
@app.get("/logs")
def get_logs():
    return {"history": join_logs}


# 3. トークン発行 ＋ 履歴追加
@app.get("/token")
def get_token(password: str = None, username: str = "匿名"):
    # 合言葉のチェック
    if password != APP_PASSWORD:
        return {"error": "Invalid password"}, 401

    # 環境変数のチェック
    if not SKYWAY_APP_ID or not SKYWAY_SECRET_KEY:
        return {"error": "Server configuration missing"}

    # --- 入室ログの更新 ---
    # 日本時間 (UTC+9) の時刻を計算
    jst_time = time.strftime("%H:%M", time.localtime(time.time() + 32400))
    log_entry = {"name": username, "time": jst_time}

    # 履歴の先頭に追加し、10件を超えたら古いものを削除
    join_logs.insert(0, log_entry)
    if len(join_logs) > 10:
        join_logs.pop()

    # --- SkyWay Auth Token の生成 ---
    now = int(time.time())
    payload = {
        "jti": str(uuid.uuid4()),
        "iat": now - 60,
        "exp": now + 3600,
        "version": 3,
        "scope": {
            "appId": SKYWAY_APP_ID,
            "rooms": [
                {
                    "name": "*",
                    "id": "*",
                    "methods": ["create", "close", "updateMetadata"],
                    "member": {
                        "name": "*",
                        "id": "*",
                        "methods": ["publish", "subscribe", "updateMetadata"]
                    }
                }
            ]
        }
    }

    token = jwt.encode(
        payload,
        SKYWAY_SECRET_KEY,
        algorithm="HS256",
        headers={"typ": "JWT"}
    )

    # トークンと履歴を一緒に返す
    return {"token": token, "history": join_logs}


# Render実行用
if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host='0.0.0.0', port=port)
