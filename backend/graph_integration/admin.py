from django.contrib import admin

from .models import Faculty, Organisation

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ("abbreviation", "name")
    search_fields = ("name", "abbreviation", "keywords")


@admin.register(Organisation)
class OrganisationAdmin(admin.ModelAdmin):
    list_display = ("abbreviation", "name", "scope")
    search_fields = ("name", "abbreviation", "mission", "target_members")
