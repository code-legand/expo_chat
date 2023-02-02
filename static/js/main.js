var labelUserName = document.querySelector('#label-username');
var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');

var username;
var socket;
var mapPeers = [];

function webSocketOnMessage(event) {
    var data = JSON.parse(event.data);
    var peerUsername = data['peer'];
    var action = data['action'];
    if (peerUsername == username) {
        return;
    }

    var reciever_channel_name = data['message']['reciever_channel_name'];
    if (action === 'new-peer'){
        console.log('New peer connected: ' + peerUsername);
        createOffer(peerUsername, reciever_channel_name);
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

btnJoin.addEventListener('click', function () {
    username = usernameInput.value;
    if (username.length < 1) {
        alert('Please enter a username');
        return;
    }
    console.log('Username: ' + username);

    // Hide the username input and button
    usernameInput.value = '';
    usernameInput.style.display = 'none';
    btnJoin.style.display = 'none';

    var labelUserName = document.querySelector('#label-username');
    labelUserName.innerHTML = username;

    // create websocket connection
    var loc = window.location;
    var wsStart = 'ws://';

    if (loc.protocol === 'https:') {
        wsStart = 'wss://';
    }

    var endpoint = wsStart + loc.host + loc.pathname;
    socket = new WebSocket(endpoint);

    socket.onopen = function (event) {
        console.log('Connected to chat server');
        
        sendSignal('new-peer', {});
    }

    socket.addEventListener('message', webSocketOnMessage);

    socket.onclose = function (event) {
        console.log('Disconnected from chat server');
    }

    socket.onerror = function (event) {
        console.log('Error: ' + event.data);
    }



});


var localStream = new MediaStream();

const constraints = {
    'audio': true,
    'video': true
};

const localVideo = document.querySelector('#local-video');
const btnToggleAudio = document.querySelector('#btn-toggle-audio');
const btnToggleVideo = document.querySelector('#btn-toggle-video');

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;

        var audioTracks = localStream.getAudioTracks();
        var videoTracks = localStream.getVideoTracks();

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click', function () {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            btnToggleAudio.innerHTML = audioTracks[0].enabled ? 'Disable Audio' : 'Enable Audio';
        });

        btnToggleVideo.addEventListener('click', function () {
            videoTracks[0].enabled = !videoTracks[0].enabled;
            btnToggleVideo.innerHTML = videoTracks[0].enabled ? 'Disable Video' : 'Enable Video';
        });
    })
    .catch(function (err) {
        console.log('Error: ' + err);
    });

var btnSendMsg = document.querySelector('#btn-send-msg');
var messageList = document.querySelector('#message-list');
var messageInput = document.querySelector('#msg');

btnSendMsg.addEventListener('click', function () {
    var message = messageInput.value;
    if (message.length < 1) {
        return;
    }
    var li = document.createElement('li');
    li.appendChild(document.createTextNode('Me:' + message));
    messageList.appendChild(li);

    var dataChannels = getDataChannels();
    message = username + ': ' + message;

    for (index in dataChannels) {
        dataChannels[index].send(message);
    }
    messageInput.value = '';
});

function sendSignal(action, message) {
    var jsonStr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    });
    socket.send(jsonStr);
}

function createOffer(peerUsername, reciever_channel_name) {
    // ******************************** uncomment this line to test the case where the users are in different networks 
    // var peer = new RTCPeerConnection( { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] } );

    // ******************************** uncomment this line to test the case where the users are in the same network
    var peer = new RTCPeerConnection(null);
    addLocalTrack(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open', function (event) {
        console.log('Data channel opened');
    });
    dc.addEventListener('message', dcOnMessage); 

    var remoteVideo = createVideo('video');
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
            console.log('new ice candidate');
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
        .then(function () {
            console.log('Offer created');
        });
}

function createAnswerer(offer, peerUsername, reciever_channel_name) {
    // ******************************** uncomment this line to test the case where the users are in different networks 
    // var peer = new RTCPeerConnection( { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] } );

    // ******************************** uncomment this line to test the case where the users are in the same network
    var peer = new RTCPeerConnection(null);
    addLocalTrack(peer);

    var remoteVideo = createVideo('peerUsername');
    setOnTrack(peer, remoteVideo);

    peer.addEventListener('datachannel', function (event) {
        peer.dc = event.channel;
        peer.dc.addEventListener('open', function (event) {
            console.log('Data channel opened');
        });
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
            console.log('new ice candidate');
            return;
        }

        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'reciever_channel_name': reciever_channel_name,
        });
    });
    peer.setRemoteDescription(offer)
        .then(function () {
            console.log('Remote description set');
            return peer.createAnswer();
        })
        .then(function (answer) {
            console.log("Answer Created")
            return peer.setLocalDescription(answer);
        });
}


function addLocalTrack(peer) {
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });
    return;
}

function dcOnMessage(event) {
    var message = event.data;
    var li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    messageList.appendChild(li);
}

function createVideo(peerUsername) {
    var videoContainer = document.querySelector('#video-container');
    var remoteVideo = document.createElement('video');
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    remoteVideo.id = peerUsername + '-video';

    var videoWrapper = document.createElement('div');
    videoContainer.appendChild(videoWrapper);
    videoWrapper.appendChild(remoteVideo);
    return remoteVideo;
}

function setOnTrack(peer, remoteVideo) {
    var remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    peer.addEventListener('track', async (event)=> {
        remoteStream.addTrack(event.track, remoteStream);
    });
}

function removeVideo(video){
    var videoWrapper = video.parentNode;
    videoWrapper.parentNode.removeChild(videoWrapper);
}


function getDataChannels() {
    var dataChannels = [];
    for (peerUsername in mapPeers) {
        var dataChannel = mapPeers[peerUsername][1];
        dataChannels.push(dataChannel);
    }
    return dataChannels;
}