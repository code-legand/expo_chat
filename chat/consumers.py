from channels.generic.websocket import AsyncWebsocketConsumer
import json

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'Test-Room'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        recieve_dict= json.loads(text_data)
        message = recieve_dict['message']
        print(recieve_dict)
        action = recieve_dict['action']

        if action == 'new-offer' or action == 'new-answer':
            reciever_channel_name = recieve_dict['message']['reciever_channel_name']
            recieve_dict['message']['reciever_channel_name'] = self.channel_name
            await self.channel_layer.send(
                reciever_channel_name,
                {
                    'type': 'send.sdp',
                    'recieve_dict': recieve_dict
                }
            )
            return
        
        recieve_dict['message']['reciever_channel_name'] = self.channel_name

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send.sdp',
                'recieve_dict': recieve_dict
            }
        )
        
    
    async def send_sdp(self, event):
        recieve_dict = event['recieve_dict']

        await self.send(text_data=json.dumps(recieve_dict))
        
