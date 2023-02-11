
from django.shortcuts import render

# Create your views here.

def main_view(request):
    """Main view for the chat app"""
    context={}
    return render(request, 'chat/main.html')
