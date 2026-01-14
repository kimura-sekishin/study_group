import os
import time
import jwt
import uuid
import boto3
import json
from boto3.dynamodb.conditions import Key

# リージョン設定（大阪: ap-northeast-3）
REGION = 'ap-northeast-3'
dynamodb = boto3.resource('dynamodb', region_name=REGION)

# テーブル定義
log_table = dynamodb.Table('SkyWayJoinLogs')
chat_table = dynamodb.Table('SkyWayChatMessages')

SKYWAY_APP_ID = os.environ.get("SKYWAY_APP_ID")
SKYWAY_SECRET_KEY = os.environ.get("SKYWAY_SECRET_KEY")
APP_PASSWORD = os.environ.get("APP_PASSWORD")
ALLOW_ORIGIN = os.environ.get("ALLOW_ORIGIN", "*")


def handler(event, context):
    # パスの取得
    path = event.get('rawPath', '')
    params = event.get('queryStringParameters', {}) or {}

    # 共通レスポンスヘッダー
    headers = {
        "Access-Control-Allow-Origin": ALLOW_ORIGIN,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*"
    }

    # 1. トークン発行 ＋ 入室履歴保存
    if "/token" in path:
        password = params.get('password')
        username = params.get('username', '匿名')

        if password != APP_PASSWORD:
            return {"statusCode": 401, "headers": headers, "body": json.dumps({"error": "Invalid password"})}

        now_ts = int(time.time())
        jst_time = time.strftime("%H:%M", time.localtime(now_ts + 32400))

        # 入室履歴の保存
        log_table.put_item(Item={'id': 'log', 'timestamp': now_ts, 'name': username, 'time': jst_time})

        # 履歴の取得
        res_log = log_table.query(KeyConditionExpression=Key('id').eq('log'), ScanIndexForward=False, Limit=10)
        history = res_log.get('Items', [])
        for item in history:
            item['timestamp'] = int(item['timestamp'])

        # SkyWayトークン生成
        now = int(time.time())
        payload = {
            "jti": str(uuid.uuid4()), "iat": now - 60, "exp": now + 3600, "version": 3,
            "scope": {
                "appId": SKYWAY_APP_ID,
                "rooms": [{"name": "*", "id": "*", "methods": ["create", "close", "updateMetadata"],
                           "member": {"name": "*", "id": "*", "methods": ["publish", "subscribe", "updateMetadata"]}}]
            }
        }
        token = jwt.encode(payload, SKYWAY_SECRET_KEY, algorithm="HS256", headers={"typ": "JWT"})

        return {"statusCode": 200, "headers": headers, "body": json.dumps({"token": token, "history": history})}

    # 2. チャット投稿
    elif "/post_chat" in path:
        username = params.get('username', '匿名')
        message = params.get('message', '')
        if not message:
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Message is empty"})}

        now_ts = int(time.time())
        jst_time = time.strftime("%H:%M", time.localtime(now_ts + 32400))

        chat_table.put_item(Item={
            'room_id': 'main',
            'timestamp': now_ts,
            'name': username,
            'message': message,
            'time': jst_time
        })
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "ok"})}

    # 3. チャット取得（最新20件）
    elif "/get_chats" in path:
        res_chat = chat_table.query(
            KeyConditionExpression=Key('room_id').eq('main'),
            ScanIndexForward=False,
            Limit=20
        )
        messages = res_chat.get('Items', [])
        for m in messages:
            m['timestamp'] = int(m['timestamp'])

        return {"statusCode": 200, "headers": headers, "body": json.dumps({"messages": messages})}

    return {"statusCode": 404, "headers": headers, "body": json.dumps({"error": "Not Found"})}
