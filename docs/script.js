import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } from '@skyway-sdk/room';

document.getElementById('join-btn').onclick = async () => {
    const statusLabel = document.getElementById('status');
    const remoteMediaArea = document.getElementById('remote-media-area');

    try {
        statusLabel.innerText = "サーバーを起動中... (初動は30秒ほどかかる場合があります)";
        
        // --- 1. Render のバックエンドからトークンを取得 ---
        // 💡 [重要] ここをあなたの Render の URL に書き換えてください
        const RENDER_BACKEND_URL = 'https://study-group-7e54.onrender.com/token'; 
        
        const response = await fetch(RENDER_BACKEND_URL);
        if (!response.ok) throw new Error("トークンの取得に失敗しました");
        
        const { token } = await response.json();

        // 2. SkyWayコンテキストの作成
        statusLabel.innerText = "SkyWayに接続中...";
        const context = await SkyWayContext.Create(token);
        
        // 3. ルームへの参加
        const room = await SkyWayRoom.FindOrCreate(context, {
            type: 'p2p',
            name: 'skyway-web-test-room'
        });

        const member = await room.join();
        statusLabel.innerText = "マイクの使用を許可してください...";

        // --- 4. 自分のマイクを取得して公開（Publish） ---
        const audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();
        await member.publish(audioStream);
        statusLabel.innerText = "接続完了！相手の入室を待っています";

        // --- 5. 相手の音声を受信して再生（Subscribe） ---
        const subscribe = async (publication) => {
            // 自分の投稿、または音声以外なら何もしない
            if (publication.publisherId === member.id || publication.contentType !== 'audio') return;

            try {
                const { stream } = await member.subscribe(publication.id);
                
                // すでに同じ音声用のaudioタグがあれば作成しない
                if (document.getElementById(`audio-${publication.id}`)) return;

                const remoteAudio = document.createElement('audio');
                remoteAudio.id = `audio-${publication.id}`;
                remoteAudio.autoplay = true;
                remoteAudio.playsInline = true; // スマホブラウザ対策
                
                stream.attach(remoteAudio);
                remoteMediaArea.appendChild(remoteAudio);
                
                statusLabel.innerText = "通話中";
            } catch (e) {
                console.error("購読エラー:", e);
            }
        };

        // すでにルームに存在する投稿を購読
        room.publications.forEach(subscribe);
        
        // 新しく投稿されたら購読する
        const eventSource = room.onPublicationAnnounced || room.onStreamPublished;
        if (eventSource && typeof eventSource.add === 'function') {
            eventSource.add(({ publication }) => subscribe(publication));
        }

    } catch (error) {
        console.error("全体エラー:", error);
        statusLabel.innerText = "エラー: " + error.message;
        alert("エラーが発生しました: " + error.message);
    }
};