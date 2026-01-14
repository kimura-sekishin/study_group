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

// チャット取得関数
const loadChats = async () => {
    try {
        const res = await fetch(`${baseUrl}/get_chats`);
        const data = await res.json();
        if (!data.messages || data.messages.length === 0) {
            chatDisplay.innerHTML = '<div style="color:#ccc;text-align:center;margin-top:20px;">メッセージはありません</div>';
            return;
        }
        
        // 配列をコピーしてからリバース（破壊的変更を避ける）
        const sortedMessages = [...data.messages].reverse();
        
        chatDisplay.innerHTML = sortedMessages.map(m => 
            `<div class="msg-item"><span class="msg-time">${m.time}</span><b>${m.name}</b>: ${m.message}</div>`
        ).join('');
        
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    } catch (e) {
        console.error("Chat Load Error:", e);
    }
};

// チャット送信関数
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

const updateMemberList = () => {
    if (!room || !member) return;
    memberList.innerHTML = room.members.map(m => 
        `<li>${m.id === member.id ? '👤' : '🟢'} ${m.metadata || '匿名'}${m.id === member.id ? ' (自分)' : ''}</li>`
    ).join('');
};

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

// 入室処理
joinBtn.onclick = async () => {
    const password = document.getElementById('app-password').value;
    const username = document.getElementById('username').value || "匿名";
    if (!password) return alert("合言葉が必要です");

    try {
        statusLabel.innerText = "認証中...";
        const res = await fetch(`${baseUrl}/token?password=${password}&username=${encodeURIComponent(username)}`);
        if (res.status === 401) throw new Error("合言葉が違います");
        if (!res.ok) throw new Error("サーバー接続失敗");
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

        // ここで即座にチャットを読み込む
        await loadChats();

        updateMemberList();
        room.on('memberJoined', updateMemberList);
        room.on('memberLeft', updateMemberList);
        room.publications.forEach(subscribe);
        room.on('publicationAnnounced', ({ publication }) => subscribe(publication));

        // 5秒おきの更新を開始
        pollInterval = setInterval(loadChats, 5000);

    } catch (e) { alert(e.message); statusLabel.innerText = "待機中"; }
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
