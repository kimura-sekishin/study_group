import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } from '@skyway-sdk/room';

let context, room, member, audioStream, publication;
let isMuted = false;

const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const muteBtn = document.getElementById('mute-btn');
const controls = document.getElementById('controls');
const statusLabel = document.getElementById('status');
const memberCountLabel = document.getElementById('member-count');

// --- 人数表示を更新する関数 ---
const updateMemberCount = () => {
    if (!room) return;
    memberCountLabel.innerText = `入室者: ${room.members.length}名`;
};

// --- 接続処理 ---
joinBtn.onclick = async () => {
    const passwordInput = document.getElementById('app-password');
    const password = passwordInput.value;

    if (!password) {
        alert("合言葉を入力してください");
        return;
    }

    try {
        statusLabel.innerText = "認証中...";
        
        // RenderのURL (変更不要)
        const response = await fetch(`https://study-group-7e54.onrender.com/token?password=${password}`);

        if (response.status === 401) {
            throw new Error("合言葉が違います");
        }
        if (!response.ok) {
            throw new Error("サーバーとの通信に失敗しました");
        }
        
        const data = await response.json();
        const token = data.token;

        statusLabel.innerText = "SkyWayに接続中...";
        context = await SkyWayContext.Create(token);
        room = await SkyWayRoom.FindOrCreate(context, { 
            type: 'p2p', 
            name: 'skyway-web-test-room' 
        });
        member = await room.join();

        // マイク公開
        statusLabel.innerText = "マイク準備中...";
        audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();
        publication = await member.publish(audioStream);

        // UI切り替え
        joinBtn.style.display = 'none';
        document.getElementById('login-area').style.display = 'none';
        controls.style.display = 'block';
        statusLabel.innerText = "接続完了";
        updateMemberCount();

        // 💡【修正点1】イベントが存在するかチェックしてから add する
        if (room.onMemberJoined) room.onMemberJoined.add(updateMemberCount);
        if (room.onMemberLeft) room.onMemberLeft.add(updateMemberCount);

        // --- 購読処理 ---
        const subscribe = async (pub) => {
            // 💡【修正点2】自分のIDなら即座にリターン（ここがエラー回避の肝）
            if (pub.publisherId === member.id || pub.contentType !== 'audio') return;

            try {
                const { stream } = await member.subscribe(pub.id);
                
                if (document.getElementById(`audio-${pub.id}`)) return;

                const remoteAudio = document.createElement('audio');
                remoteAudio.id = `audio-${pub.id}`;
                remoteAudio.autoplay = true;
                remoteAudio.playsInline = true;
                stream.attach(remoteAudio);
                document.getElementById('remote-media-area').appendChild(remoteAudio);
                statusLabel.innerText = "通話中";
            } catch (e) {
                // publicationNotExist エラーは無視してOK（タイミングの問題）
                if (e.name !== 'publicationNotExist') {
                    console.error("購読エラー:", e);
                }
            }
        };

        // すでにルームにある投稿を購読
        room.publications.forEach(subscribe);
        
        // 💡【修正点3】エラーの原因になっていた「重複した古い書き方」を削除し、
        // 以下の「安全な書き方」だけに統一しました
        const announcedEvent = room.onPublicationAnnounced || room.onStreamPublished;
        if (announcedEvent && typeof announcedEvent.add === 'function') {
            announcedEvent.add(({ publication }) => subscribe(publication));
        }

    } catch (error) {
        console.error("全体エラー:", error);
        statusLabel.innerText = "待機中";
        alert(error.message);
    }
};

// --- ミュート切り替え ---
muteBtn.onclick = () => {
    if (!audioStream) return;
    
    isMuted = !isMuted;
    audioStream.track.enabled = !isMuted;
    
    if (isMuted) {
        muteBtn.innerText = "ミュート解除";
        muteBtn.classList.add('is-muted');
        statusLabel.innerText = "ミュート中";
    } else {
        muteBtn.innerText = "マイクをミュート";
        muteBtn.classList.remove('is-muted');
        statusLabel.innerText = "通話中";
    }
};

// --- 切断処理 ---
leaveBtn.onclick = async () => {
    statusLabel.innerText = "切断中...";
    
    if (member) await member.leave();
    if (room) await room.dispose();
    if (context) context.dispose();
    if (audioStream) audioStream.release();

    document.getElementById('remote-media-area').innerHTML = '';
    joinBtn.style.display = 'inline-block';
    document.getElementById('login-area').style.display = 'block';
    controls.style.display = 'none';
    statusLabel.innerText = "待機中";
    memberCountLabel.innerText = "入室者: 0名";
    isMuted = false;
    muteBtn.innerText = "マイクをミュート";
    muteBtn.classList.remove('is-muted');
};