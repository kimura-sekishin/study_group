import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory } from '@skyway-sdk/room';

let context, room, member, audioStream, publication;
let isMuted = false;

const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const muteBtn = document.getElementById('mute-btn');
const controls = document.getElementById('controls');
const statusLabel = document.getElementById('status');
const memberList = document.getElementById('member-list'); // リスト表示用

// --- 💡 参加者リストを更新する関数 ---
const updateMemberList = () => {
    if (!room) return;
    
    // リストを一度クリア
    memberList.innerHTML = '';

    // ルームにいる全員の情報をループして表示
    room.members.forEach(m => {
        // metadataに名前が入っていればそれを使い、なければ "匿名"
        const name = m.metadata || "匿名";
        const li = document.createElement('li');
        
        // 自分自身には「(自分)」をつけると分かりやすい
        if (m.id === member.id) {
            li.innerText = `👤 ${name} (自分)`;
        } else {
            li.innerText = `🟢 ${name}`;
        }
        memberList.appendChild(li);
    });
};

// --- 履歴を表示する関数 ---
const updateHistoryUI = (history) => {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    history.forEach(log => {
        const li = document.createElement('li');
        li.innerText = `${log.time} - ${log.name} さんが入室しました`;
        historyList.appendChild(li);
    });
};

// --- 接続処理 ---
joinBtn.onclick = async () => {
    const passwordInput = document.getElementById('app-password');
    const nameInput = document.getElementById('username'); // 名前取得
    
    const password = passwordInput.value;
    // 名前が空なら「匿名」にする
    const username = nameInput.value || "匿名";

    if (!password) {
        alert("合言葉を入力してください");
        return;
    }

    try {
        statusLabel.innerText = "認証中...";
        
        // 💡 サーバーに名前も送るように修正
        const response = await fetch(`https://study-group-7e54.onrender.com/token?password=${password}&username=${encodeURIComponent(username)}`);

        if (response.status === 401) throw new Error("合言葉が違います");
        if (!response.ok) throw new Error("サーバーとの通信に失敗しました");
        
        const data = await response.json();
        // 💡 履歴を更新
        if (data.history) {
            updateHistoryUI(data.history);
        }
        const token = data.token;

        statusLabel.innerText = "接続中...";
        context = await SkyWayContext.Create(token);
        room = await SkyWayRoom.FindOrCreate(context, { 
            type: 'p2p', 
            name: 'skyway-web-test-room' 
        });

        // 💡 ここで名前（metadata）を持たせて入室！
        member = await room.join({ metadata: username });

        // マイク公開
        statusLabel.innerText = "マイク準備中...";
        audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();
        publication = await member.publish(audioStream);

        // UI切り替え
        joinBtn.style.display = 'none';
        document.getElementById('login-area').style.display = 'none';
        controls.style.display = 'block';
        memberList.style.display = 'block'; // リストを表示
        statusLabel.innerText = "接続完了";
        
        // リスト更新
        updateMemberList();

        // 💡 メンバーの参加・退室時にリストを更新
        if (room.onMemberJoined) room.onMemberJoined.add(updateMemberList);
        if (room.onMemberLeft) room.onMemberLeft.add(updateMemberList);

        // --- 購読処理 ---
        const subscribe = async (pub) => {
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
                if (e.name !== 'publicationNotExist') console.error("購読エラー:", e);
            }
        };

        room.publications.forEach(subscribe);
        
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
    memberList.style.display = 'none'; // リストを隠す
    statusLabel.innerText = "待機中";
    memberList.innerHTML = ''; // リストの中身をクリア
    isMuted = false;
    muteBtn.innerText = "マイクをミュート";
    muteBtn.classList.remove('is-muted');
};