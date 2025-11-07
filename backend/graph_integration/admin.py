from django.contrib import admin

from .models import Faculty

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ("abbreviation", "name")
    search_fields = ("name", "abbreviation", "keywords")
