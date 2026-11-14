import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/atualiza_posts.py'

class AtualizaPostsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.cwd = os.getcwd()
        os.chdir(self.temp.name)
        self.addCleanup(os.chdir, self.cwd)
        Path('novo-site/data').mkdir(parents=True)
        Path('menu').mkdir()
        Path('menu/timeline-menu.js').write_text('// menu')
        self.seed = {'updated': 'anterior', 'subscribers': '46 mil', 'programas': {'conversa': {'videos': []}}}
        Path('novo-site/index.html').write_text('<script type="application/json" id="seed">\n' + json.dumps(self.seed) + '\n</script>')
        self.url = 'https://example.test/capa.png'
        self.color = 'red'
        self.fail = False

    def download(self, args, **kwargs):
        url = args[-1]
        if '/archive?' in url:
            body = json.dumps({'posts': [{'title': 'Artigo existente', 'canonical_url': 'https://example.test/artigo', 'cover_image': self.url, 'post_date': '2026-11-01', 'publishedBylines': [{'name': 'Autor'}]}], 'nextCursor': None}).encode()
        elif url == self.url:
            if self.fail:
                return subprocess.CompletedProcess(args, 0, b'falha\n503', b'')
            out = io.BytesIO()
            Image.new('RGB', (20, 10), self.color).save(out, 'PNG')
            body = out.getvalue()
        else:
            body = b'{}'
        return subprocess.CompletedProcess(args, 0, body + b'\n200', b'')

    def run_script(self):
        with patch('subprocess.run', side_effect=self.download), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            runpy.run_path(str(SCRIPT))
        text = Path('novo-site/index.html').read_text()
        return json.loads(text.split('id="seed">\n')[1].split('\n</script>')[0])

    def test_same_url_changed_content_and_stable_repeat(self):
        first = self.run_script()
        self.color = 'blue'
        second = self.run_script()
        self.assertNotEqual(first['img'][self.url]['b'], second['img'][self.url]['b'])
        self.assertEqual(first['posts'], second['posts'])
        self.assertEqual(first['subscribers'], second['subscribers'])
        self.assertEqual(first['programas'], second['programas'])
        self.assertEqual(second, self.run_script())
        image = second['img'][self.url]
        with Image.open('novo-site/' + image['b'] + '-1200.webp') as im:
            self.assertGreater(im.getpixel((0, 0))[2], 200)

    def test_new_url_updates_existing_article_without_duplicate(self):
        self.run_script()
        self.url = 'https://example.test/corrigida.png'
        result = self.run_script()
        posts = json.loads(Path('novo-site/data/posts.json').read_text())['posts']
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]['image'], self.url)
        self.assertEqual(result['posts'], posts)
        self.assertIn(self.url, result['img'])

    def test_failed_image_keeps_last_valid_files(self):
        first = self.run_script()
        self.fail = True
        second = self.run_script()
        self.assertEqual(first['img'], second['img'])
        image = second['img'][self.url]
        self.assertTrue(all(Path('novo-site/' + image['b'] + '-' + str(w) + '.webp').exists() for w in image['w']))

if __name__ == '__main__':
    unittest.main()
