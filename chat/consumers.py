"""
ChatConsumer class to handle WebSocket communication between clients and the server
AsyncWebsocketConsumer is a base consumer class from Django Channels that handles WebSocket communication
It enables the use of asynchronous communication methods and handling of multiple connections simultaneously
"""

from channels.generic.websocket import AsyncWebsocketConsumer
import json

class ChatConsumer(AsyncWebsocketConsumer):
    # Method called when a WebSocket connection is initiated
    async def connect(self):
        # Extract the room group name from the URL path
        self.room_group_name = self.scope['path'].strip('/')

        # Add the client to the room group for the room
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        # Accept the WebSocket connection
        await self.accept()

    # Method called when a WebSocket connection is closed
    async def disconnect(self, close_code):
        # Remove the client from the room group for the room
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Method called when a WebSocket message is received
    async def receive(self, text_data):
        # Extract the message and action from the received data
        recieve_dict= json.loads(text_data)
        message = recieve_dict['message']
        action = recieve_dict['action']

        # If the action is 'new-offer' or 'new-answer', send the message to the reciever
        if action == 'new-offer' or action == 'new-answer':
            # Change the reciever_channel_name to the current channel_name
            reciever_channel_name = recieve_dict['message']['reciever_channel_name']
            recieve_dict['message']['reciever_channel_name'] = self.channel_name
            # Send the message to the reciever
            await self.channel_layer.send(
                reciever_channel_name,
                {
                    'type': 'send.sdp',
                    'recieve_dict': recieve_dict
                }
            )
            # Change the reciever_channel_name back to the original reciever_channel_name
            return
      
        # If the action is 'new-ice-candidate', send the message to the reciever
        recieve_dict['message']['reciever_channel_name'] = self.channel_name

        # Send the message to the room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send.sdp',
                'recieve_dict': recieve_dict
            }
        )
    
    # Method called when a message is sent to the room group
    async def send_sdp(self, event):
        recieve_dict = event['recieve_dict']

        # Send the message to the WebSocket
        await self.send(text_data=json.dumps(recieve_dict))

