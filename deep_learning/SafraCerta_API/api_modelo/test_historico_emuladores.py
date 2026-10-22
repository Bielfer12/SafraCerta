from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from io import BytesIO
from os import environ
from types import SimpleNamespace
from unittest import TestCase, main
from unittest.mock import Mock, patch
from uuid import uuid4

import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import HTTPException
from fastapi.testclient import TestClient
from google.auth.credentials import AnonymousCredentials
from PIL import Image
import requests
import torch

if environ.get('GCLOUD_PROJECT') != 'demo-safracerta' or not all(environ.get(chave) for chave in ('FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'STORAGE_EMULATOR_HOST')):
    raise RuntimeError('Execute somente com os três emuladores e o projeto demo-safracerta.')


class CredencialEmulador(credentials.Base):
    def get_credential(self):
        return AnonymousCredentials()


firebase_admin.initialize_app(CredencialEmulador(), {'projectId': 'demo-safracerta', 'storageBucket': 'safracerta-ee9ce.firebasestorage.app'})
import app as api
import historico


class HistoricoEmuladores(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.banco = firestore.client()
        resposta = requests.post(f"http://{environ['FIREBASE_AUTH_EMULATOR_HOST']}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=teste", json={'email': f'{uuid4()}@teste.local', 'password': 'Teste-local-123!', 'returnSecureToken': True}, timeout=10)
        resposta.raise_for_status()
        cls.token = resposta.json()['idToken']
        cls.uid = resposta.json()['localId']

    def setUp(self):
        self.banco.document(f'usuarios/{self.uid}').set({'tipoUsuario': 'FUNCIONARIO', 'statusConta': 'ATIVO'})
        self.id = f'python-{uuid4()}'
        self.ref = self.banco.document(f'analises/{self.id}')
        self.ref.set({'usuarioId': self.uid, 'status': 'AGUARDANDO_ENVIO', 'expiraEm': datetime.now(timezone.utc) + timedelta(minutes=10), 'foto': {'situacao': 'PENDENTE', 'sha256': None}})
        dados = BytesIO()
        with Image.new('RGB', (200, 100), 'green') as imagem:
            imagem.save(dados, 'JPEG')
        self.foto = dados.getvalue()
        self.modelo = {'nome': 'classificador-teste', 'pesosSha256': 'teste', 'apiVersao': 'teste'}

    def test_transacao_rejeita_outro_usuario_e_hash_diferente(self):
        with self.assertRaises(HTTPException):
            historico.assumir(self.id, 'outro-usuario', self.foto, self.modelo)
        self.assertIsNone(historico.assumir(self.id, self.uid, self.foto, self.modelo))
        with self.assertRaises(HTTPException):
            historico.assumir(self.id, self.uid, b'outra-imagem', self.modelo)
        self.assertEqual(historico.assumir(self.id, self.uid, self.foto, self.modelo)['status'], 'EM_PROCESSAMENTO')

    def test_apenas_uma_requisicao_assume_processamento_concorrente(self):
        with ThreadPoolExecutor(max_workers=2) as executor:
            respostas = list(executor.map(lambda _: historico.assumir(self.id, self.uid, self.foto, self.modelo), range(2)))
        self.assertEqual(sum(item is None for item in respostas), 1)

    def test_foto_e_resultado_persistidos_e_encerramento_imutavel(self):
        historico.assumir(self.id, self.uid, self.foto, self.modelo)
        historico.salvar_foto(self.id, self.uid, self.foto, 'JPEG', (200, 100))
        foto = self.ref.get().to_dict()['foto']
        self.assertEqual(foto['situacao'], 'SALVA')
        self.assertTrue(foto['geracao'])
        historico.finalizar(self.id, self.foto, {'classe': 'healthy', 'pontuacao': 0.8}, 50)
        with self.assertRaises(HTTPException):
            historico.falhar(self.id, self.foto, 'ERRO', 'TESTE', 'Não deve substituir', 70)
        atual = self.ref.get().to_dict()
        self.assertEqual(atual['status'], 'CONCLUIDA')
        self.assertEqual(atual['resultado']['classe'], 'healthy')

    def test_perfil_inativo_e_tentativa_expirada_nao_processam(self):
        self.banco.document(f'usuarios/{self.uid}').update({'statusConta': 'INATIVO'})
        with self.assertRaises(HTTPException):
            historico.assumir(self.id, self.uid, self.foto, self.modelo)
        self.banco.document(f'usuarios/{self.uid}').update({'statusConta': 'ATIVO'})
        self.ref.update({'expiraEm': datetime.now(timezone.utc) - timedelta(seconds=1)})
        with self.assertRaises(HTTPException):
            historico.assumir(self.id, self.uid, self.foto, self.modelo)

    def test_falha_de_validacao_encerra_tentativa_sem_foto_ou_resultado(self):
        historico.assumir(self.id, self.uid, self.foto, self.modelo)
        historico.falhar(self.id, self.foto, 'IMAGEM_INVALIDA', 'VALIDACAO', 'Arquivo inválido', 10)
        atual = self.ref.get().to_dict()
        self.assertEqual(atual['status'], 'FALHOU')
        self.assertEqual(atual['foto']['situacao'], 'FALHA')
        self.assertIsNone(atual['resultado'])
        self.assertIsNotNone(atual['finalizadoEm'])

    def test_rota_autenticada_salva_foto_e_resultado_sem_mock_do_firebase(self):
        classificador = Mock(task='classify', names={0: 'healthy', 1: 'brown_spot'})
        classificador.predict.return_value = [SimpleNamespace(probs=SimpleNamespace(data=torch.tensor([0.8, 0.2])))]
        detector = Mock(task='detect', names={0: 'folha'})
        detector.predict.return_value = [SimpleNamespace(names={0: 'folha'}, boxes=[SimpleNamespace(xyxy=torch.tensor([[20, 10, 180, 90]]), conf=torch.tensor([0.9]), cls=torch.tensor([0]))])]
        with patch.object(api, 'YOLO', side_effect=[classificador, detector]), patch.object(api, 'LESOES_PATH', None), TestClient(api.app) as cliente:
            resposta = cliente.post('/analisar', data={'analise_id': self.id}, files={'foto': ('foto.jpg', self.foto, 'image/jpeg')}, headers={'Authorization': f'Bearer {self.token}'})
            self.assertEqual(resposta.status_code, 200, resposta.text)
            atual = self.ref.get().to_dict()
            self.assertEqual(atual['status'], 'CONCLUIDA')
            self.assertEqual(atual['foto']['situacao'], 'SALVA')
            self.assertEqual(atual['resultado']['classe'], 'healthy')
            classificador.predict.reset_mock()
            repetida = cliente.post('/analisar', data={'analise_id': self.id}, files={'foto': ('foto.jpg', self.foto, 'image/jpeg')}, headers={'Authorization': f'Bearer {self.token}'})
            self.assertEqual(repetida.status_code, 200)
            classificador.predict.assert_not_called()


if __name__ == '__main__':
    main()
