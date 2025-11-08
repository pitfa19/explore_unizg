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
    cluster = models.IntegerField(null=True, blank=True, default=None)
    knn_edges = models.JSONField(default=list, blank=True)

    def __str__(self) -> str:
        return f"{self.abbreviation or ''} {self.name}".strip()

class Organisation(models.Model):
    name = models.CharField(max_length=255)
    abbreviation = models.CharField(max_length=64, blank=True)
    scope = models.CharField(max_length=128, blank=True)
    mission = models.TextField(blank=True)
    domains = models.JSONField(default=list, blank=True)
    core_activities = models.JSONField(default=list, blank=True)
    flagship_projects = models.JSONField(default=list, blank=True)
    target_members = models.CharField(max_length=255, blank=True)
    affiliations = models.JSONField(default=list, blank=True)
    partnerships = models.JSONField(null=True, blank=True, default=None)
    skills_outcomes = models.JSONField(default=list, blank=True)
    keywords = models.JSONField(default=list, blank=True)
    url = models.URLField(max_length=500, blank=True)
    social = models.JSONField(null=True, blank=True, default=None)
    embedding = models.JSONField(null=True, blank=True, default=None)
    cluster = models.IntegerField(null=True, blank=True, default=None)
    knn_edges = models.JSONField(default=list, blank=True)

    def __str__(self) -> str:
        return f"{(self.abbreviation or '').strip()} {self.name}".strip()
