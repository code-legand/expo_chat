const room_id = document.querySelector('#room-id');
const labelRoomId = document.querySelector('#label-room-id');
const labelUserName = document.querySelector('#label-username');
const usernameInput = document.querySelector('#username');
const btnJoin = document.querySelector('#btn-join');
const btnLeave = document.querySelector('#btn-leave');
const mainStreamContainer = document.querySelector('#main-stream-container');
const navbarAppName = document.querySelector('#navbar-app-name');
const navbarLogo = document.getElementsByClassName('navbar-logo');
const usernameDisplay = document.querySelector('#username-display');
const connectionContainer = document.querySelector('#connection-container');
const btnSendMsg = document.querySelector('#btn-send-msg');
const messageList = document.querySelector('#message-list');
const messageInput = document.querySelector('#msg');
const localVideo = document.querySelector('#local-video');
const btnToggleAudio = document.querySelector('#btn-toggle-audio');
const btnToggleVideo = document.querySelector('#btn-toggle-video');

var username = usernameInput.value;
var socket;
var mapPeers = [];

const constraints = {
    'audio': true,
    'video': true
};

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;

        var audioTracks = localStream.getAudioTracks();
        var videoTracks = localStream.getVideoTracks();

        audioTracks[0].enabled = false;
        videoTracks[0].enabled = false;

        btnToggleAudio.addEventListener('click', function () {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            btnToggleAudio.innerHTML = audioTracks[0].enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            btnToggleAudio.className = audioTracks[0].enabled ? 'btn btn-lg border-3 rounded-circle p-2 green-button' : 'btn btn-lg border-3 rounded-circle p-2 red-button';
            
        });

        btnToggleVideo.addEventListener('click', function () {
            videoTracks[0].enabled = !videoTracks[0].enabled;
            btnToggleVideo.innerHTML = videoTracks[0].enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            btnToggleVideo.className = videoTracks[0].enabled ? 'btn btn-lg border-3 rounded-circle p-2 green-button' : 'btn btn-lg border-3 rounded-circle p-2 red-button';
        });
    })
    .catch(function (err) {
        var message = 'Unable to access your camera and microphone. Please check your camera and microphone settings and try again.';
        var con = confirm(message);
        if (con) {
            window.location.reload();
        }
    });

btnJoin.addEventListener('click', function () {
    username = usernameInput.value;
    if (room_id.value.length < 1) {
        alert('Invalid room id');
        return;
    }

    if (usernameInput.value.length < 1) {
        alert('Invalid username');
        return;
    }

    mainGridEnlarge();
    var loc = window.location;
    var wsStart = 'ws://';

    if (loc.protocol === 'https:') {
        wsStart = 'wss://';
    }

    var room_group_name = room_id.value;
    var endpoint = wsStart + loc.host + loc.pathname + room_group_name + '/';
    socket = new WebSocket(endpoint);

    socket.onopen = function (event) {
        sendSignal('new-peer', {});
    }

    socket.addEventListener('message', webSocketOnMessage);

    socket.onerror = function (event) {
        alert('Connection error');
    }
});

btnLeave.addEventListener('click', function () {
    socket.close();
    location.reload();
});

function mainGridEnlarge(){
    navbarLogo[0].height=100;
    navbarLogo[0].width=100;
    navbarLogo[1].height=100;
    navbarLogo[1].width=100;
    navbarAppName.className = 'h1 display-4';
    usernameInput.value = '';
    connectionContainer.style.cssText = 'display: none !important';
    mainStreamContainer.style.display = 'block';
    usernameDisplay.innerHTML = 'welcome, ' + username;
}

function webSocketOnMessage(event) {
    var data = JSON.parse(event.data);
    var peerUsername = data['peer'];
    var action = data['action'];
    if (peerUsername == username) {
        return;
    }

    var reciever_channel_name = data['message']['reciever_channel_name'];
    if (action === 'new-peer'){
        createOfferer(peerUsername, reciever_channel_name);
    }

    if(action === 'new-offer'){
        var offer = data['message']['sdp'];
        createAnswerer(offer, peerUsername, reciever_channel_name);
        return;
    }

    if(action === 'new-answer'){
        var answer = data['message']['sdp'];
        var peer = mapPeers[peerUsername][0];
        peer.setRemoteDescription(answer);
        return;
    }
}

function createOfferer(peerUsername, reciever_channel_name) {
    // ******************************** uncomment this line to test the case where the users are in different networks 
    // var peer = new RTCPeerConnection( { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] } );

    // ******************************** uncomment this line to test the case where the users are in the same network
    var peer = new RTCPeerConnection(null);
    addLocalTrack(peer);

    var dc = peer.createDataChannel('channel');

    dc.addEventListener('message', dcOnMessage); 

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);
    mapPeers[peerUsername] = [peer, dc];

    peer.addEventListener('iceconnectionstatechange', function (event) {
        var iceconnectionstate = peer.iceConnectionState;

        if (iceconnectionstate === 'disconnected' || iceconnectionstate === 'failed' || iceconnectionstate === 'closed') {
            delete mapPeers[peerUsername];

            if (iceconnectionstate != 'closed') {
                peer.close();
            }
            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate', function (event) {
        if (event.candidate) {
            return;
        }

        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'reciever_channel_name': reciever_channel_name,
        });
    });
    peer.createOffer()
        .then(function (offer) {
            return peer.setLocalDescription(offer);
        })
}

function createAnswerer(offer, peerUsername, reciever_channel_name) {
    // ******************************** uncomment this line to test the case where the users are in different networks 
    // var peer = new RTCPeerConnection( { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] } );

    // ******************************** uncomment this line to test the case where the users are in the same network
    var peer = new RTCPeerConnection(null);
    addLocalTrack(peer);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);
    peer.addEventListener('datachannel', function (event) {
        peer.dc = event.channel;
        peer.dc.addEventListener('message', dcOnMessage); 
        mapPeers[peerUsername] = [peer, peer.dc];
    });

    peer.addEventListener('iceconnectionstatechange', function (event) {
        var iceconnectionstate = peer.iceConnectionState;
        if (iceconnectionstate === 'disconnected' || iceconnectionstate === 'failed' || iceconnectionstate === 'closed') {
            delete mapPeers[peerUsername];

            if (iceconnectionstate != 'closed') {
                peer.close();
            }
            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate', function (event) {
        if (event.candidate) {
            return;
        }

        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'reciever_channel_name': reciever_channel_name,
        });
    });
    peer.setRemoteDescription(offer)
        .then(function () {
            return peer.createAnswer();
        })
        .then(function (answer) {
            return peer.setLocalDescription(answer);
        });
}

function addLocalTrack(peer) {
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });
    return;
}

function createVideo(peerUsername) {
    var videoContainer = document.querySelector('#video-container');
    var remoteVideo = document.createElement('video');
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    remoteVideo.className = 'mw-100';    
    remoteVideo.attributes['data-username'] = peerUsername;
    remoteVideo.id = peerUsername + '-video';

    var username = document.createElement('div');
    username.className = 'username ';
    username.appendChild(document.createTextNode(peerUsername));

    var fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'fullscreen-btn btn btn-sm btn-outline-light rounded-circle';
    fullscreenBtn.setAttribute('title', 'Fullscreen');
    var fullscreenIcon = document.createElement('i');
    fullscreenIcon.className = 'fas fa-expand';
    fullscreenBtn.appendChild(fullscreenIcon);

    fullscreenBtn.addEventListener('click', function () {
        if (remoteVideo.requestFullscreen) {
            remoteVideo.requestFullscreen();
        } else if (remoteVideo.mozRequestFullScreen) {
            remoteVideo.mozRequestFullScreen();
        } else if (remoteVideo.webkitRequestFullscreen) {
            remoteVideo.webkitRequestFullscreen();
        } else if (remoteVideo.msRequestFullscreen) {
            remoteVideo.msRequestFullscreen();
        }
    });

    var controlWrapper = document.createElement('div');
    controlWrapper.className = 'container-fluid';
    controlRow = document.createElement('div');
    controlRow.className = 'row';
    controlWrapper.appendChild(controlRow);
    controlCol1 = document.createElement('div');
    controlCol1.className = 'col-6';
    controlCol2 = document.createElement('div');
    controlCol2.className = 'col-6 d-flex justify-content-end';
    controlRow.appendChild(controlCol1);
    controlRow.appendChild(controlCol2);
    controlCol1.appendChild(username);
    controlCol2.appendChild(fullscreenBtn);

    var videoWrapper = document.createElement('div');
    videoWrapper.className = 'flex-grow-1 col-12 col-md-6 col-xl-4';
    videoContainer.appendChild(videoWrapper);
    videoWrapper.appendChild(remoteVideo);
    videoWrapper.appendChild(controlWrapper);
    return remoteVideo;
}

function setOnTrack(peer, remoteVideo) {
    var remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    peer.addEventListener('track', async (event)=> {
        remoteStream.addTrack(event.track, remoteStream);
    });
}

btnSendMsg.addEventListener('click', function () {
    var message = messageInput.value;
    if (message.length < 1) {
        return;
    }
    var li = document.createElement('li');
    li.appendChild(document.createTextNode('Me: ' + message));
    messageList.appendChild(li);

    var dataChannels = getDataChannels();
    message = username + ': ' + message;

    for (index in dataChannels) {
        dataChannels[index].send(message);
    }
    messageInput.value = '';
});

function getDataChannels() {
    var dataChannels = [];
    for (peerUsername in mapPeers) {
        var dataChannel = mapPeers[peerUsername][1];
        dataChannels.push(dataChannel);
    }
    return dataChannels;
}

function sendSignal(action, message) {
    var jsonStr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    });
    socket.send(jsonStr);
}

function dcOnMessage(event) {
    var message = event.data;
    var li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    messageList.appendChild(li);
}

function removeVideo(video){
    var videoWrapper = video.parentNode;
    videoWrapper.parentNode.removeChild(videoWrapper);
}
