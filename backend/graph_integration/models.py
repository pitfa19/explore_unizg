from django.db import models

class Faculty(models.Model):
    name = models.CharField(max_length=255)
    abbreviation = models.CharField(max_length=32)
    domain_areas = models.TextField(blank=True)
    programs = models.TextField(blank=True)
    research_topics = models.TextField(blank=True)
    methods_and_tech = models.TextField(blank=True)
    affiliations_and_labs = models.TextField(blank=True)
    typical_outputs = models.TextField(blank=True)
    keywords = models.TextField(blank=True)
    url = models.URLField(max_length=500, blank=True)
    embedding = models.JSONField(null=True, blank=True, default=None)

    def __str__(self) -> str:
        return f"{self.abbreviation or ''} {self.name}".strip()
