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
    // 自分を含めた合計人数を表示
    memberCountLabel.innerText = `入室者: ${room.members.length}名`;
};

// --- 接続処理 ---
joinBtn.onclick = async () => {
    try {
        statusLabel.innerText = "接続中...";
        
        const response = await fetch('https://study-group-7e54.onrender.com/token'); // 自分のURLに書き換え
        const { token } = await response.json();

        context = await SkyWayContext.Create(token);
        room = await SkyWayRoom.FindOrCreate(context, { type: 'p2p', name: 'skyway-web-test-room' });
        member = await room.join();

        // 自分のマイクを公開
        audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();
        publication = await member.publish(audioStream);

        // UI切り替え
        joinBtn.style.display = 'none';
        controls.style.display = 'block';
        statusLabel.innerText = "接続完了";
        updateMemberCount();

        // 相手が参加・退室した時に人数を更新
        room.onMemberJoined.add(updateMemberCount);
        room.onMemberLeft.add(updateMemberCount);

        // 購読処理
        const subscribe = async (pub) => {
            if (pub.publisherId === member.id || pub.contentType !== 'audio') return;
            const { stream } = await member.subscribe(pub.id);
            const remoteAudio = document.createElement('audio');
            remoteAudio.id = `audio-${pub.id}`;
            remoteAudio.autoplay = true;
            remoteAudio.playsInline = true;
            stream.attach(remoteAudio);
            document.getElementById('remote-media-area').appendChild(remoteAudio);
        };

        room.publications.forEach(subscribe);
        room.onPublicationAnnounced.add(({ publication }) => subscribe(publication));

    } catch (error) {
        console.error(error);
        alert("エラー: " + error.message);
    }
};

// --- ミュート切り替え ---
muteBtn.onclick = () => {
    if (!audioStream) return;
    
    isMuted = !isMuted;
    // getTracks()[0].enabled を操作する
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

    // 状態リセット
    document.getElementById('remote-media-area').innerHTML = '';
    joinBtn.style.display = 'inline-block';
    controls.style.display = 'none';
    statusLabel.innerText = "待機中";
    memberCountLabel.innerText = "入室者: 0名";
    isMuted = false;
    muteBtn.innerText = "マイクをミュート";
    muteBtn.classList.remove('is-muted');
};