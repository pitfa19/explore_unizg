"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.http import HttpResponse
from openai_integration.views import process_message, embed_student_and_knn
from graph_integration.views import upsert_faculty, list_faculty_edges, get_faculty, info


def home(_request):
    return HttpResponse("OK")

urlpatterns = [
    path('', home, name='home'),
    path('api/message/', process_message, name='process_message'),
    path('api/embed-student/', embed_student_and_knn, name='embed_student_and_knn'),
    path('api/faculties/upsert/', upsert_faculty, name='upsert_faculty'),
    path('api/faculties/edges/', list_faculty_edges, name='list_faculty_edges'),
    path('api/faculties/get/', get_faculty, name='get_faculty'),
    path('api/info/', info, name='info'),
    path('admin/', admin.site.urls),
]


