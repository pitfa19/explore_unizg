from django.contrib import admin

from .models import Student

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("name", "messages_count")
    readonly_fields = ("messages_count",)

    def messages_count(self, obj: Student) -> int:
        return len(obj.messages or [])
    messages_count.short_description = "Messages"
