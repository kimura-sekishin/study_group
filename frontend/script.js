import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } from '@skyway-sdk/room';

document.getElementById('join-btn').onclick = async () => {
    const statusLabel = document.getElementById('status');
    const remoteMediaArea = document.getElementById('remote-media-area');

    try {
        statusLabel.innerText = "トークン取得中...";
        
        // ローカルのPythonサーバーからトークンを取得
        // const response = await fetch('http://127.0.0.1:8000/token');
        const response = await fetch('http://192.168.179.7:8000/token');
        const { token } = await response.json();

        statusLabel.innerText = "SkyWayに接続中...";
        const context = await SkyWayContext.Create(token);
        
        const room = await SkyWayRoom.FindOrCreate(context, {
            type: 'p2p',
            name: 'local-test-room'
        });

        const member = await room.join();
        statusLabel.innerText = "マイク準備中...";

        // 自分のマイクを公開
        const audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();
        await member.publish(audioStream);
        statusLabel.innerText = "接続完了！相手を待っています";

        // --- 相手の音声を購読する処理（修正版） ---
        const subscribe = async (publication) => {
            // 1. 自分の投稿なら何もしない（publicationNotExist対策）
            if (publication.publisherId === member.id) return;
            // 2. 音声以外なら何もしない
            if (publication.contentType !== 'audio') return;

            try {
                const { stream } = await member.subscribe(publication.id);
                
                // すでに同じ音声用のaudioタグがあれば作成しない
                if (document.getElementById(`audio-${publication.id}`)) return;

                const remoteAudio = document.createElement('audio');
                remoteAudio.id = `audio-${publication.id}`;
                remoteAudio.autoplay = true;
                
                stream.attach(remoteAudio);
                remoteMediaArea.appendChild(remoteAudio);
                
                statusLabel.innerText = "通話中";
                console.log("相手の音声を購読しました");
            } catch (e) {
                console.error("購読エラー:", e);
            }
        };

        // すでにルームに存在する投稿を購読
        room.publications.forEach(subscribe);
        
        // --- SDKのバージョンによるイベント名の違いを吸収 ---
        // onPublicationAnnounced がダメなら onStreamPublished を試す
        const eventSource = room.onPublicationAnnounced || room.onStreamPublished;

        if (eventSource && typeof eventSource.add === 'function') {
            eventSource.add(({ publication }) => subscribe(publication));
        } else {
            // 万が一どちらもダメな場合の予備（古い書き方）
            room.on('publicationAnnounced', ({ publication }) => subscribe(publication));
        }

    } catch (error) {
        console.error("全体エラー:", error);
        statusLabel.innerText = "エラー: " + error.message;
    }
};