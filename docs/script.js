import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } from '@skyway-sdk/room';

const baseUrl = "https://isdw7jpzcj.execute-api.ap-northeast-3.amazonaws.com/default";
let context, room, member, audioStream, pollInterval;
let isMuted = false;

const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const muteBtn = document.getElementById('mute-btn');
const statusLabel = document.getElementById('status');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatDisplay = document.getElementById('chat-display');
const memberList = document.getElementById('member-list');

// --- チャット取得 ---
const loadChats = async () => {
    try {
        const res = await fetch(`${baseUrl}/get_chats`);
        const data = await res.json();
        if (!data.messages) return;
        
        // 最新が下に来るように並び替えて表示
        chatDisplay.innerHTML = data.messages.reverse().map(m => 
            `<div class="msg-item"><span class="msg-time">${m.time}</span><b>${m.name}</b>: ${m.message}</div>`
        ).join('');
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    } catch (e) { console.error("チャット取得失敗:", e); }
};

// --- チャット送信 ---
const sendChat = async () => {
    const msg = chatInput.value.trim();
    const name = document.getElementById('username').value || "匿名";
    if (!msg) return;
    try {
        await fetch(`${baseUrl}/post_chat?username=${encodeURIComponent(name)}&message=${encodeURIComponent(msg)}`);
        chatInput.value = '';
        await loadChats();
    } catch (e) { console.error("送信失敗:", e); }
};

// --- 参加者リスト更新 ---
const updateMemberList = () => {
    if (!room) return;
    memberList.innerHTML = room.members.map(m => {
        const name = m.metadata || "匿名";
        return `<li>${m.id === member.id ? '👤' : '🟢'} ${name}${m.id === member.id ? ' (自分)' : ''}</li>`;
    }).join('');
};

// --- 購読処理（音が聞こえるようにする重要処理） ---
const subscribe = async (pub) => {
    if (pub.publisherId === member.id || pub.contentType !== 'audio') return;
    
    // すでに同じパブリケーションを購読していないか確認（重複防止）
    if (document.getElementById(`audio-${pub.id}`)) return;

    try {
        const { stream } = await member.subscribe(pub.id);
        const remoteAudio = document.createElement('audio');
        remoteAudio.id = `audio-${pub.id}`;
        remoteAudio.autoplay = true;
        remoteAudio.playsInline = true;
        stream.attach(remoteAudio);
        document.getElementById('remote-media-area').appendChild(remoteAudio);
    } catch (e) {
        console.error("購読エラー:", e);
    }
};

// --- 入室処理 ---
joinBtn.onclick = async () => {
    const password = document.getElementById('app-password').value;
    const username = document.getElementById('username').value || "匿名";
    if (!password) return alert("合言葉を入力してください");

    try {
        statusLabel.innerText = "認証中...";
        const res = await fetch(`${baseUrl}/token?password=${password}&username=${encodeURIComponent(username)}`);
        
        if (res.status === 401) throw new Error("合言葉が違います");
        if (!res.ok) throw new Error("サーバー接続エラー");
        
        const data = await res.json();
        
        // 入室履歴の表示
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = data.history.map(h => `<li>${h.time} - ${h.name} さんが入室</li>`).join('');

        statusLabel.innerText = "接続中...";
        context = await SkyWayContext.Create(data.token);
        room = await SkyWayRoom.FindOrCreate(context, { type: 'p2p', name: 'skyway-web-test-room' });
        
        // 名前を載せて入室
        member = await room.join({ metadata: username });

        // マイク公開
        audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();
        await member.publish(audioStream);

        // UI表示
        document.getElementById('login-area').style.display = 'none';
        document.getElementById('controls').style.display = 'block';
        document.getElementById('chat-section').style.display = 'block';
        memberList.style.display = 'block';
        statusLabel.innerText = "通話中";

        // 初期表示とイベント登録
        updateMemberList();
        room.onMemberJoined.add(updateMemberList);
        room.onMemberLeft.add(updateMemberList);

        // 既存の音声を購読
        room.publications.forEach(subscribe);
        // 新しく入ってきた人の音声を購読
        room.onPublicationAnnounced.add(({ publication }) => subscribe(publication));

        // チャット機能開始
        await loadChats();
        pollInterval = setInterval(loadChats, 5000);

    } catch (e) {
        console.error("全体エラー:", e);
        alert(e.message);
        statusLabel.innerText = "待機中";
    }
};

// --- 各種ボタンイベント ---
sendChatBtn.onclick = sendChat;
chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendChat(); };

muteBtn.onclick = () => {
    if (!audioStream) return;
    isMuted = !isMuted;
    audioStream.track.enabled = !isMuted;
    muteBtn.innerText = isMuted ? "マイクをオンにする" : "マイクをミュート";
    muteBtn.classList.toggle('is-muted', isMuted);
    statusLabel.innerText = isMuted ? "ミュート中" : "通話中";
};

leaveBtn.onclick = () => {
    // リロードするのが一番確実に全リソースを解放できます
    location.reload();
};