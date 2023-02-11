// Selecting all the necessary elements from the DOM
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

// Storing the value of the username input in a variable
var username = usernameInput.value;
var socket;
var mapPeers = [];

// Object for setting up audio and video constraints
const constraints = {
    'audio': true,
    'video': true
};

// Get user media (camera and microphone)
var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
        // Initialize userMedia variable with the result of navigator.mediaDevices.getUserMedia 
        // with the passed in constraints
        localStream = stream;
        localVideo.srcObject = localStream;
        // Mute the local video
        localVideo.muted = true;

        // Get the audio and video tracks from the stream
        var audioTracks = localStream.getAudioTracks();
        var videoTracks = localStream.getVideoTracks();

        // Disable the audio and video tracks
        audioTracks[0].enabled = false;
        videoTracks[0].enabled = false;

        // Add event listeners to the buttons
        btnToggleAudio.addEventListener('click', function () {
            // Toggle the enabled property of the audio track
            audioTracks[0].enabled = !audioTracks[0].enabled;
            // Change the icon and the color of the button depending on the state of the audio track
            btnToggleAudio.innerHTML = audioTracks[0].enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            btnToggleAudio.className = audioTracks[0].enabled ? 'btn btn-lg border-3 rounded-circle p-2 green-button' : 'btn btn-lg border-3 rounded-circle p-2 red-button';

        });

        btnToggleVideo.addEventListener('click', function () {
            // Toggle the enabled property of the video track
            videoTracks[0].enabled = !videoTracks[0].enabled;
            // Change the icon and the color of the button depending on the state of the video track
            btnToggleVideo.innerHTML = videoTracks[0].enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            btnToggleVideo.className = videoTracks[0].enabled ? 'btn btn-lg border-3 rounded-circle p-2 green-button' : 'btn btn-lg border-3 rounded-circle p-2 red-button';
        });
    })
    .catch(function (err) {
        // If there is an error, display an alert message
        var message = 'Unable to access your camera and microphone. Please check your camera and microphone settings and try again.';
        var con = confirm(message);
        // If the user clicks on the OK button, reload the page
        if (con) {
            window.location.reload();
        }
    });

// listen for the click event on the join button
btnJoin.addEventListener('click', function () {
    username = usernameInput.value;
    // Check if the room id and username are valid
    if (room_id.value.length < 1) {
        alert('Invalid room id');
        return;
    }

    if (usernameInput.value.length < 1) {
        alert('Invalid username');
        return;
    }

    // Hide the connection container and show the main stream container
    mainGridEnlarge();

    // Connect to the websocket
    var loc = window.location;
    var wsStart = 'ws://';  // default to ws://

    // If the protocol is https, change the wsStart to wss://
    if (loc.protocol === 'https:') {
        wsStart = 'wss://';
    }

    // Create the websocket endpoint
    var room_group_name = room_id.value;
    var endpoint = wsStart + loc.host + loc.pathname + room_group_name + '/';
    socket = new WebSocket(endpoint);

    // When the socket is opened, send a signal to the server
    socket.onopen = function (event) {
        sendSignal('new-peer', {});
    }

    // When a message is received from the server, handle the message
    socket.addEventListener('message', webSocketOnMessage);

    // When the socket is closed, display an alert message
    socket.onerror = function (event) {
        alert('Connection error');
    }
});

// listen for the click event on the disconnect button
btnLeave.addEventListener('click', function () {
    // Close the socket
    socket.close();
    location.reload();
});

function mainGridEnlarge() {
    // Hide the connection container and show the main stream container
    // Change the size of the logo and the app name
    navbarLogo[0].height = 100;
    navbarLogo[0].width = 100;
    navbarLogo[1].height = 100;
    navbarLogo[1].width = 100;
    navbarAppName.className = 'h1 display-4';

    usernameInput.value = '';
    connectionContainer.style.cssText = 'display: none !important';
    mainStreamContainer.style.display = 'block';
    usernameDisplay.innerHTML = 'welcome, ' + username;
}

// This function handles incoming WebSocket messages
function webSocketOnMessage(event) {
    // Parse the received data into a JavaScript object
    var data = JSON.parse(event.data);
    var peerUsername = data['peer'];
    var action = data['action'];

    // If the message was sent by the current user, return without processing
    if (peerUsername == username) {
        return;
    }

    // Get the name of the receiver channel
    var reciever_channel_name = data['message']['reciever_channel_name'];

    // If the message is a new peer, create an offerer
    if (action === 'new-peer') {
        createOfferer(peerUsername, reciever_channel_name);
    }

    // If the message is a new offer, create an answerer
    if (action === 'new-offer') {
        var offer = data['message']['sdp'];
        createAnswerer(offer, peerUsername, reciever_channel_name);
        return;
    }

    // If the action type is "new-answer", set the remote description
    if (action === 'new-answer') {
        var answer = data['message']['sdp'];
        var peer = mapPeers[peerUsername][0];
        peer.setRemoteDescription(answer);
        return;
    }
}

// This function creates an offerer
function createOfferer(peerUsername, reciever_channel_name) {
    // ******************************** uncomment this line to test the case where the users are in different networks 
    // var peer = new RTCPeerConnection( { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] } );

    // ******************************** uncomment this line to test the case where the users are in the same network
    var peer = new RTCPeerConnection(null);

    // Add the local stream to the peer
    addLocalTrack(peer);

    // Create a data channel
    var dc = peer.createDataChannel('channel');

    // Add the data channel event listeners
    dc.addEventListener('message', dcOnMessage);

    // Create a video element for the remote stream
    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);
    mapPeers[peerUsername] = [peer, dc];

    // Add the peer event listeners for the ice connection state
    peer.addEventListener('iceconnectionstatechange', function (event) {
        var iceconnectionstate = peer.iceConnectionState;

        // If the ice connection state is disconnected, failed or closed, delete the peer from the map
        if (iceconnectionstate === 'disconnected' || iceconnectionstate === 'failed' || iceconnectionstate === 'closed') {
            delete mapPeers[peerUsername];

            // If the ice connection state is not closed, close the peer
            if (iceconnectionstate != 'closed') {
                peer.close();
            }

            // Remove the video element for the remote stream
            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate', function (event) {
        if (event.candidate) {
            return;
        }

        // Send the local description to the server
        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'reciever_channel_name': reciever_channel_name,
        });
    });

    // Create an offer and set the local description
    peer.createOffer()
        .then(function (offer) {
            return peer.setLocalDescription(offer);
        })
}

// This function creates an RTCPeerConnection and a data channel for a new peer
function createAnswerer(offer, peerUsername, reciever_channel_name) {
    // Create an RTCPeerConnection, either with the default settings or with specific ice servers if the users are in different networks

    // ******************************** uncomment this line to test the case where the users are in different networks 
    // var peer = new RTCPeerConnection( { 'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}] } );

    // ******************************** uncomment this line to test the case where the users are in the same network
    var peer = new RTCPeerConnection(null);
    // Add the local stream tracks to the RTCPeerConnection
    addLocalTrack(peer);
    // Create a data channel
    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    // Set the remote description
    peer.addEventListener('datachannel', function (event) {
        peer.dc = event.channel;
        peer.dc.addEventListener('message', dcOnMessage);
        mapPeers[peerUsername] = [peer, peer.dc];
    });

    // Add an event listener for the 'iceconnectionstatechange' event on the RTCPeerConnection
    peer.addEventListener('iceconnectionstatechange', function (event) {
        // get the current state of ice connection
        var iceconnectionstate = peer.iceConnectionState;

        // if the connection is disconnected or failed or closed remove the peer from mapPeers
        if (iceconnectionstate === 'disconnected' || iceconnectionstate === 'failed' || iceconnectionstate === 'closed') {
            delete mapPeers[peerUsername];

            // if the connection state is not closed, close the peer connection
            if (iceconnectionstate != 'closed') {
                peer.close();
            }

            // remove the video for the remote peer
            removeVideo(remoteVideo);
        }
    });

    // event listener to get ice candidates
    peer.addEventListener('icecandidate', function (event) {
        // if there is an ice candidate available send the new answer with SDP and receiver channel name
        if (event.candidate) {
            return;
        }
        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'reciever_channel_name': reciever_channel_name,
        });
    });

    // set the remote description to the peer and create an answer
    peer.setRemoteDescription(offer)
        .then(function () {
            return peer.createAnswer();
        })
        .then(function (answer) {
            return peer.setLocalDescription(answer);
        });
}

// This function adds the local media tracks (audio and/or video) to a new peer connection.
function addLocalTrack(peer) {
    // Get all the tracks (audio and/or video) from the local media stream.
    localStream.getTracks().forEach(track => {
        // Add each track to the new peer connection.
        peer.addTrack(track, localStream);
    });
    return;
}

// This function creates a new video element and its related elements (username, fullscreen button)
// It also adds event listener for the fullscreen button
function createVideo(peerUsername) {
    // Select the container for all the videos
    var videoContainer = document.querySelector('#video-container');
    // Create a new video element
    var remoteVideo = document.createElement('video');
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    remoteVideo.className = 'mw-100';
    remoteVideo.attributes['data-username'] = peerUsername;
    remoteVideo.id = peerUsername + '-video';

    // Create a new element to display the username
    var username = document.createElement('div');
    username.className = 'username ';
    username.appendChild(document.createTextNode(peerUsername));

    // Create a new fullscreen button
    var fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'fullscreen-btn btn btn-sm btn-outline-light rounded-circle';
    fullscreenBtn.setAttribute('title', 'Fullscreen');
    var fullscreenIcon = document.createElement('i');
    fullscreenIcon.className = 'fas fa-expand';
    fullscreenBtn.appendChild(fullscreenIcon);

    // Add an event listener to the fullscreen button
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

    // Create a new container for the username and fullscreen button
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

    // Create a new container for the video and its controls
    var videoWrapper = document.createElement('div');
    videoWrapper.className = 'flex-grow-1 col-12 col-md-6 col-xl-4';
    videoContainer.appendChild(videoWrapper);
    videoWrapper.appendChild(remoteVideo);
    videoWrapper.appendChild(controlWrapper);

    // Return the video element
    return remoteVideo;
}

// Function to set 'track' event listener on a peer connection
function setOnTrack(peer, remoteVideo) {
    // Create a new MediaStream object to store the remote stream
    var remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    // Add event listener for 'track' event on the peer connection
    peer.addEventListener('track', async (event) => {
        // Add the received track to the remote stream
        remoteStream.addTrack(event.track, remoteStream);
    });
}

// This code adds a click event listener to the "btnSendMsg" button to send a message
btnSendMsg.addEventListener('click', function () {
    // Get the message from the input field
    var message = messageInput.value;
    // Check if the message is empty
    if (message.length < 1) {
        return;
    }

    // Create a list item and add the message to it with the format "Me: message"
    var li = document.createElement('li');
    li.appendChild(document.createTextNode('Me: ' + message));
    messageList.appendChild(li);
    // Get all the data channels from the peers
    var dataChannels = getDataChannels();
    // Append the username to the message
    message = username + ': ' + message;
    // Send the message to each data channel

    for (index in dataChannels) {
        dataChannels[index].send(message);
    }
    // Clear the input field
    messageInput.value = '';
});

// This function returns an array of all the data channels
function getDataChannels() {
    // An array to store the data channels
    var dataChannels = [];

    // Iterate through all the peers and add their data channel to the array
    for (peerUsername in mapPeers) {
        var dataChannel = mapPeers[peerUsername][1];
        dataChannels.push(dataChannel);
    }

    // Return the array of data channels
    return dataChannels;
}

// Function to send a signal to the socket
// action - type of signal, e.g. offer, answer, ice-candidate
// message - signal message
function sendSignal(action, message) {
    // Create a JSON object with the signal data
    var jsonStr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    });
    socket.send(jsonStr);
}

// Event handler for receiving messages from data channel
function dcOnMessage(event) {
    var message = event.data;
    // create an li element to display the message
    var li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    messageList.appendChild(li);
}

// Function to remove a video element from the page when a peer leaves
function removeVideo(video) {
    // Get the parent element of the video element
    var videoWrapper = video.parentNode;
    // Remove the video element from the page
    videoWrapper.parentNode.removeChild(videoWrapper);
}
