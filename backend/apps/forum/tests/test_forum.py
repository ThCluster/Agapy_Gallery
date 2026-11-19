from django.contrib.auth import get_user_model

from apps.accounts.models import ArtistStatus
from apps.accounts.tests.helpers import BaseTestCase, make_artist
from apps.forum.models import Category, Post, Report, Topic

URL = "/api/v1/forum/"


class ForumTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.artist = self.user.artist
        self.cat = Category.objects.create(slug="mutual", name="Entraide", description="Entraide entre artistes")
        Category.objects.create(slug="techniques", name="Techniques")
        self.topic = Topic.objects.create(category=self.cat, author=self.artist, title="Premier sujet",
                                          body="Bonjour à tous")

    def login_artist(self):
        res = self.login()
        self.assertEqual(res.status_code, 200, res.content)
        self.auth(res.data["access"])

    def test_public_read(self):
        Post.objects.create(topic=self.topic, author=self.artist, body="Réponse visible")
        Post.objects.create(topic=self.topic, author=self.artist, body="Masquée", is_hidden=True)
        pinned = Topic.objects.create(category=self.cat, author=self.artist, title="Sujet épinglé", body="Règles",
                                      is_pinned=True)

        cats = self.client.get(URL + "categories/").json()
        self.assertEqual(cats[0], {"id": self.cat.id, "slug": "mutual", "name": "Entraide",
                                   "description": "Entraide entre artistes", "topic_count": 2})

        page = self.client.get(URL + "topics/").json()
        self.assertEqual(page["count"], 2)
        first, second = page["results"]
        self.assertEqual(first["id"], pinned.id)
        self.assertEqual(second["post_count"], 1)
        self.assertEqual(second["author"], {"name": "Awa Koné", "artist_id": self.artist.slug})
        self.assertEqual(second["category"], {"slug": "mutual", "name": "Entraide"})
        self.assertNotIn("body", second)
        self.assertEqual(self.client.get(URL + "topics/?category=techniques").json()["count"], 0)
        self.assertEqual(self.client.get(URL + "topics/?q=épinglé").json()["count"], 1)

        detail = self.client.get(f"{URL}topics/{self.topic.id}/").json()
        self.assertEqual(detail["body"], "Bonjour à tous")
        posts = self.client.get(f"{URL}topics/{self.topic.id}/posts/").json()
        self.assertEqual([p["body"] for p in posts["results"]], ["Réponse visible"])

        # Un jeton invalide n'empêche pas la lecture
        self.client.credentials(HTTP_AUTHORIZATION="Bearer abc")
        self.assertEqual(self.client.get(URL + "topics/").status_code, 200)

    def test_write_requires_artist(self):
        res = self.client.post(URL + "topics/", {"category": "mutual", "title": "Un titre", "body": "Corps"},
                               format="json")
        self.assertEqual(res.status_code, 401)

        staff = get_user_model().objects.create_user(phone="+2250700000099", password="ARTS2026", is_staff=True)
        self.client.force_authenticate(staff)
        res = self.client.post(URL + "topics/", {"category": "mutual", "title": "Un titre", "body": "Corps"},
                               format="json")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data["codes"]["detail"], "not_an_artist")

        self.artist.status = ArtistStatus.EXCLUDED
        self.artist.save()
        self.client.force_authenticate(self.user)
        res = self.client.post(f"{URL}topics/{self.topic.id}/posts/", {"body": "Coucou"}, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data["codes"]["detail"], "not_an_artist")

    def test_create_topic_and_reply(self):
        self.login_artist()
        res = self.client.post(URL + "topics/", {"category": "mutual", "title": "Nouveau sujet", "body": "Contenu"},
                               format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["body"], "Contenu")
        self.assertEqual(res.data["post_count"], 0)
        topic_id = res.data["id"]

        bad = self.client.post(URL + "topics/", {"category": "mutual", "title": "Abc", "body": "x"}, format="json")
        self.assertEqual(bad.status_code, 400)
        self.assertIn("title", bad.data)
        self.assertIn("body", bad.data)

        res = self.client.post(f"{URL}topics/{topic_id}/posts/", {"body": "Ma réponse"}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["author"]["artist_id"], self.artist.slug)
        topic = Topic.objects.get(pk=topic_id)
        self.assertEqual(topic.last_post_at, Post.objects.get(pk=res.data["id"]).created_at)

        topic.is_locked = True
        topic.save()
        res = self.client.post(f"{URL}topics/{topic_id}/posts/", {"body": "Encore"}, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data["codes"]["detail"], "topic_locked")

    def test_report(self):
        post = Post.objects.create(topic=self.topic, author=self.artist, body="Message")
        for _ in range(10):
            res = self.client.post(f"{URL}posts/{post.id}/report/", {"reason": "Propos injurieux"}, format="json")
            self.assertEqual(res.status_code, 202)
        self.assertEqual(Report.objects.filter(post=post).count(), 10)
        res = self.client.post(f"{URL}posts/{post.id}/report/", {"reason": "Propos injurieux"}, format="json")
        self.assertEqual(res.status_code, 429)
