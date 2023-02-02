var labelUserName = document.querySelector('#label-username');
var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');

var username;
var socket;

function webSocketOnMessage(event) {
    var data = JSON.parse(event.data);
    var Message = data['message'];
    console.log(Message);
}

btnJoin.addEventListener('click', function () {
    username = usernameInput.value;
    if (username.length < 1) {
        alert('Please enter a username');
        return;
    }
    console.log('Username: ' + username);
    labelUserName.innerHTML = username;

    // Hide the username input and button
    usernameInput.style.display = 'none';
    btnJoin.style.display = 'none';

    // create websocket connection
    var loc = window.location;
    var wsStart = 'ws://';

    if (loc.protocol === 'https:') {
        wsStart = 'wss://';
    }

    var endpoint = wsStart + loc.host + loc.pathname;
    var socket = new WebSocket(endpoint);

    socket.onopen = function (event) {
        console.log('Connected to chat server');
        socket.send(JSON.stringify({
            'message': 'Hello from ' + username
        }));
    }

    socket.onmessage = function (event) {
        console.log('Message received: ' + event.data);
    }

    socket.onclose = function (event) {
        console.log('Disconnected from chat server');
    }

    socket.onerror = function (event) {
        console.log('Error: ' + event.data);
    }



});
