# SkyWay Study Room (Serverless Voice Chat & Chat)

AWS LambdaとDynamoDBをバックエンドに使用した、完全サーバーレスなボイス＆テキストチャットアプリケーションです。

## 🚀 プロジェクトの概要
特定のグループで利用することを目的とした軽量なWeb会議ツールです。
Renderなどの無料枠で見られる「スリープによる遅延」を解消するため、AWS Lambdaを採用し、高速な起動と低コスト運用を実現しています。

### 主な機能
- **認証:** 合言葉による簡易入室制限
- **ボイスチャット:** SkyWay SDKを利用したP2P音声通話
- **テキストチャット:** DynamoDBを活用した掲示板機能（5秒間隔のポーリング更新）
- **入室履歴:** 最新の入室状況を自動記録・表示
- **サーバーレス:** AWS Lambda + API Gateway によるオートスケーリング

## 🏗 システム構成図


- **Frontend:** GitHub Pages (HTML5, CSS3, Vanilla JS)
- **Real-time Media:** SkyWay SDK (@skyway-sdk/room)
- **Backend:** AWS Lambda (Python 3.12)
- **Database:** Amazon DynamoDB
- **API Management:** AWS API Gateway (HTTP API)

## 🤖 AI Context (AIへの情報提供用)
今後、AI（Gemini, ChatGPT等）に機能追加やデバッグを依頼する際は、以下の情報をコピーして渡すとスムーズです。

- **Runtime:** Python 3.12 (Requires PyJWT layer)
- **Infrastructure:**
  - API Gateway ($default stage) ↔ Lambda
  - Lambda ↔ DynamoDB (2 Tables)
- **DynamoDB Schema:**
  - `SkyWayJoinLogs`: PK=`id` (String), SK=`timestamp` (Number)
  - `SkyWayChatMessages`: PK=`room_id` (String), SK=`timestamp` (Number)
- **Endpoints:**
  - `GET /token`: 認証 + SkyWay Auth Token発行 + 入室ログ記録
  - `GET /post_chat`: チャット投稿 (Query params: `username`, `message`)
  - `GET /get_chats`: 最新20件のチャット取得
- **Current JS Library:** SkyWay SDK v3 (using `.onMemberJoined.add()` style events)

## 🛠 セットアップ
1. **AWS側:**
   - Lambda関数を作成し `main.py` をアップロード。
   - `PyJWT` ライブラリをレイヤーとして追加。
   - 環境変数を設定 (`SKYWAY_APP_ID`, `SKYWAY_SECRET_KEY`, `APP_PASSWORD`, `ALLOW_ORIGIN`)。
   - API Gatewayで `GET /token`, `GET /post_chat`, `GET /get_chats` のルートを作成。

2. **Frontend側:**
   - `script.js` の `baseUrl` をAPI GatewayのURLに書き換え。
   - GitHub Pagesにデプロイ。

## 📝 ライセンス
MIT License
