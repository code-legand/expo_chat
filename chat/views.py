from django.shortcuts import render, redirect, HttpResponse
from django.http import JsonResponse, FileResponse
import datetime
import uuid
import os
from django.views.decorators.csrf import csrf_exempt

# Create your views here.

def main_view(request):
    context={}
    return render(request, 'chat/main.html')
