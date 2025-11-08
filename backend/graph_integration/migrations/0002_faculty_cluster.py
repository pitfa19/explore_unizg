from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('graph_integration', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='faculty',
            name='cluster',
            field=models.IntegerField(blank=True, null=True, default=None),
        ),
    ]


