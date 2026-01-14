import os
import time
import jwt
import uuid
import boto3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from boto3.dynamodb.conditions import Key

app = FastAPI()
handler = Mangum(app)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOW_ORIGIN")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS DynamoDB設定
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-3')
table = dynamodb.Table('SkyWayJoinLogs')

SKYWAY_APP_ID = os.environ.get("SKYWAY_APP_ID")
SKYWAY_SECRET_KEY = os.environ.get("SKYWAY_SECRET_KEY")
APP_PASSWORD = os.environ.get("APP_PASSWORD")


@app.get("/")
def read_root():
    return {"status": "ok"}


@app.get("/token")
def get_token(password: str = None, username: str = "匿名"):
    if password != APP_PASSWORD:
        return {"error": "Invalid password"}, 401

    # --- DynamoDBに入室履歴を保存 ---
    now_ts = int(time.time())
    jst_time = time.strftime("%H:%M", time.localtime(now_ts + 32400))

    table.put_item(Item={
        'id': 'log',  # 全件取得しやすくするため固定
        'timestamp': now_ts,
        'name': username,
        'time': jst_time
    })

    # --- 履歴を取得（最新10件） ---
    response = table.query(
        KeyConditionExpression=Key('id').eq('log'),
        ScanIndexForward=False,  # 降順（新しい順）
        Limit=10
    )
    history = response.get('Items', [])

    # --- SkyWay Token生成 (以前と同じ) ---
    now = int(time.time())
    payload = {
        "jti": str(uuid.uuid4()),
        "iat": now - 60,
        "exp": now + 3600,
        "version": 3,
        "scope": {
            "appId": SKYWAY_APP_ID,
            "rooms": [{
                "name": "*", "id": "*", "methods": ["create", "close", "updateMetadata"],
                "member": {"name": "*", "id": "*", "methods": ["publish", "subscribe", "updateMetadata"]}
            }]
        }
    }
    token = jwt.encode(payload, SKYWAY_SECRET_KEY, algorithm="HS256", headers={"typ": "JWT"})

    return {"token": token, "history": history}
