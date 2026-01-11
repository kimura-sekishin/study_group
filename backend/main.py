import time
import jwt
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ローカル開発のため、すべてのオリジンからのアクセスを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SKYWAY_APP_ID = "9ba950b0-e323-4179-8921-c0db3526e539"
SKYWAY_SECRET_KEY = "QkG4tugeF2GbRolfT/myRx8TclJvZMoK6tOHSG7T2lE="


@app.get("/token")
def get_token():
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
    token = jwt.encode(payload, SKYWAY_SECRET_KEY, algorithm="HS256", headers={"typ": "JWT"})
    return {"token": token}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8000)
