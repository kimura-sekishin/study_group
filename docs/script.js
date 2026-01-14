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

// --- チャット取得関数 ---
const loadChats = async () => {
    try {
        const res = await fetch(`${baseUrl}/get_chats`);
        const data = await res.json();
        if (!data.messages || data.messages.length === 0) {
            chatDisplay.innerHTML = '<div style="color:#ccc;text-align:center;margin-top:20px;">メッセージはありません</div>';
            return;
        }
        const sortedMessages = [...data.messages].reverse();
        chatDisplay.innerHTML = sortedMessages.map(m => 
            `<div class="msg-item"><span class="msg-time">${m.time}</span><b>${m.name}</b>: ${m.message}</div>`
        ).join('');
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    } catch (e) { console.error("Chat Load Error:", e); }
};

// --- チャット送信関数 ---
const sendChat = async () => {
    const msg = chatInput.value.trim();
    const name = document.getElementById('username').value || "匿名";
    if (!msg) return;
    try {
        await fetch(`${baseUrl}/post_chat?username=${encodeURIComponent(name)}&message=${encodeURIComponent(msg)}`);
        chatInput.value = '';
        await loadChats();
    } catch (e) { console.error("Send Error", e); }
};

// --- 参加者リスト更新 ---
const updateMemberList = () => {
    if (!room || !member) return;
    memberList.innerHTML = room.members.map(m => 
        `<li>${m.id === member.id ? '👤' : '🟢'} ${m.metadata || '匿名'}${m.id === member.id ? ' (自分)' : ''}</li>`
    ).join('');
};

// --- 購読処理 ---
const subscribe = async (pub) => {
    if (pub.publisherId === member.id || pub.contentType !== 'audio') return;
    if (document.getElementById(`audio-${pub.id}`)) return;
    try {
        const { stream } = await member.subscribe(pub.id);
        const el = document.createElement('audio');
        el.id = `audio-${pub.id}`;
        el.autoplay = true; el.playsInline = true;
        stream.attach(el);
        document.getElementById('remote-media-area').appendChild(el);
    } catch (e) {
        if (e.name !== 'publicationNotExist') console.error("Subscribe Error", e);
    }
};

// --- 入室処理 ---
joinBtn.onclick = async () => {
    const password = document.getElementById('app-password').value;
    const username = document.getElementById('username').value || "匿名";
    if (!password) return alert("合言葉が必要です");

    try {
        statusLabel.innerText = "認証中...";
        const res = await fetch(`${baseUrl}/token?password=${password}&username=${encodeURIComponent(username)}`);
        if (res.status === 401) throw new Error("合言葉が違います");
        const data = await res.json();
        
        document.getElementById('history-list').innerHTML = data.history.map(h => `<li>${h.time} - ${h.name} さん</li>`).join('');

        statusLabel.innerText = "接続中...";
        context = await SkyWayContext.Create(data.token);
        room = await SkyWayRoom.FindOrCreate(context, { type: 'p2p', name: 'study-room-v2' });
        member = await room.join({ metadata: username });

        audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();
        await member.publish(audioStream);

        // UI表示
        document.getElementById('login-area').style.display = 'none';
        document.getElementById('controls').style.display = 'block';
        document.getElementById('chat-section').style.display = 'block';
        memberList.style.display = 'block';
        statusLabel.innerText = "通話中";

        // 💡 修正: チャットを最初に読み込む（エラーが出る前に実行）
        await loadChats();
        pollInterval = setInterval(loadChats, 5000);

        // 💡 修正: .on() が使えない場合でも動くように add() を使う
        updateMemberList();
        
        // イベント登録（安全な書き方）
        if (room.onMemberJoined) room.onMemberJoined.add(updateMemberList);
        if (room.onMemberLeft) room.onMemberLeft.add(updateMemberList);
        
        room.publications.forEach(subscribe);
        if (room.onPublicationAnnounced) {
            room.onPublicationAnnounced.add(({ publication }) => subscribe(publication));
        }

    } catch (e) { 
        console.error("Fatal Error:", e);
        alert(e.message); 
        statusLabel.innerText = "待機中"; 
    }
};

sendChatBtn.onclick = sendChat;
chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendChat(); };
muteBtn.onclick = () => {
    isMuted = !isMuted;
    audioStream.track.enabled = !isMuted;
    muteBtn.innerText = isMuted ? "マイクをONにする" : "マイクをミュート";
    muteBtn.classList.toggle('is-muted', isMuted);
    statusLabel.innerText = isMuted ? "ミュート中" : "通話中";
};
leaveBtn.onclick = () => location.reload();
