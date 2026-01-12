import os
import time
import jwt
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS設定：GitHub Pagesからのアクセスを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://kimura-sekishin.github.io"],  # 特定のドメインに制限する場合は ["https://あなたのユーザー名.github.io"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# 環境変数から取得（設定されていない場合はエラーになるように設定）
SKYWAY_APP_ID = os.environ.get("SKYWAY_APP_ID")
SKYWAY_SECRET_KEY = os.environ.get("SKYWAY_SECRET_KEY")

# 環境変数から合言葉を取得
APP_PASSWORD = os.environ.get("APP_PASSWORD", "default_pass")

# 履歴を保存するリスト（最大10件程度）
join_logs = []


@app.get("/token")
def get_token(password: str = None, username: str = "匿名"):
    # 合言葉のチェック
    if password != APP_PASSWORD:
        return {"error": "Invalid password"}, 401

    # 万が一環境変数が設定されていない場合のチェック
    if not SKYWAY_APP_ID or not SKYWAY_SECRET_KEY:
        return {"error": "Server configuration missing"}

    # 入室ログを追加
    jst_time = time.strftime("%H:%M", time.localtime(time.time() + 32400))  # 日本時間(UTC+9)
    log_entry = {"name": username, "time": jst_time}
    join_logs.insert(0, log_entry)  # 先頭に追加

    # 最大10件に制限
    if len(join_logs) > 10:
        join_logs.pop()

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

    # トークンと一緒に履歴も返す
    return {"token": token, "history": join_logs}


# Renderでは環境変数の PORT を使用するため、起動部分を調整
if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host='0.0.0.0', port=port)
