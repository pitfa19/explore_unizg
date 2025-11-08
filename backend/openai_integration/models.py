from django.db import models
from django.core.exceptions import ValidationError
from django.db.models import JSONField
from typing import Literal, List, Optional
from pydantic import BaseModel, Field, ValidationError as PydValidationError, RootModel


class MessageItem(BaseModel):
    role: Literal["user", "agent"]
    content: str = Field(min_length=1)
    created_at: Optional[str] = None  # ISO8601 string


class Conversation(RootModel[List[MessageItem]]):
    pass


class Student(models.Model):
    name = models.CharField(max_length=255)
    messages = JSONField(default=list, blank=True)
    embedding = JSONField(null=True, blank=True, default=None)

    def __str__(self) -> str:
        return self.name

    def clean(self):
        try:
            Conversation.model_validate(self.messages)
        except PydValidationError as e:
            raise ValidationError({"messages": str(e)})
