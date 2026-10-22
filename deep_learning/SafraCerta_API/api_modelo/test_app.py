from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest import TestCase, main
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from PIL import Image
import torch

import app as api


def resultado_caixas(caixas, nome='folha'):
    return SimpleNamespace(names={0: nome}, boxes=[SimpleNamespace(
        xyxy=torch.tensor([valores], dtype=torch.float32),
        conf=torch.tensor([0.9]),
        cls=torch.tensor([0]),
    ) for valores in caixas])


class AnaliseTeste(TestCase):
    def setUp(self):
        self.classificador = Mock(task='classify', names={0: 'healthy', 1: 'brown_spot'})
        self.classificador.predict.return_value = [SimpleNamespace(probs=SimpleNamespace(data=torch.tensor([0.8, 0.2])))]
        self.detector = Mock(task='detect', names={0: 'folha'})
        self.detector.predict.return_value = [resultado_caixas([[20, 10, 180, 90]])]
        self.lesoes = Mock(task='detect', names={0: 'lesao'})
        self.lesoes.predict.return_value = [resultado_caixas([[50, 30, 90, 50]], 'lesao')]
        self.pasta = TemporaryDirectory()
        self.peso_lesoes = Path(self.pasta.name) / 'lesoes.pt'
        self.peso_lesoes.touch()

    def tearDown(self):
        self.pasta.cleanup()

    def carregar(self, caminho):
        if Path(caminho) == api.CLASSIFICADOR_PATH:
            return self.classificador
        if Path(caminho) == api.DETECTOR_PATH:
            return self.detector
        return self.lesoes

    def cliente(self, lesoes=False):
        self.patch_yolo = patch.object(api, 'YOLO', side_effect=self.carregar)
        self.patch_lesoes = patch.object(api, 'LESOES_PATH', self.peso_lesoes if lesoes else None)
        self.patch_yolo.start()
        self.patch_lesoes.start()
        self.addCleanup(self.patch_yolo.stop)
        self.addCleanup(self.patch_lesoes.stop)
        return TestClient(api.app)

    def foto(self, formato='JPEG', orientacao=None):
        dados = BytesIO()
        imagem = Image.new('RGB', (200, 100), 'green')
        exif = Image.Exif()
        if orientacao:
            exif[274] = orientacao
        if formato == 'JPEG':
            imagem.save(dados, formato, exif=exif)
        else:
            imagem.save(dados, formato)
        imagem.close()
        return dados.getvalue()

    def enviar(self, cliente, conteudo=None):
        return cliente.post('/analisar', files={'foto': ('folha.jpg', self.foto() if conteudo is None else conteudo, 'image/jpeg')})

    def test_contrato_completo_preserva_classificacao_e_distingue_lesoes_ausentes(self):
        with self.cliente() as cliente:
            self.assertFalse(cliente.get('/saude').json()['detector_lesoes_carregado'])
            self.assertEqual(len(cliente.get('/classes').json()), 2)
            resposta = self.enviar(cliente)
            self.assertEqual(resposta.status_code, 200)
            dados = resposta.json()
            self.assertEqual(dados['classe'], 'healthy')
            self.assertEqual(dados['fonte_classificacao'], 'imagem_completa')
            self.assertEqual(len(dados['top3']), 2)
            self.assertEqual(dados['imagem'], {'largura': 200, 'altura': 100})
            self.assertEqual(dados['deteccao_folha']['itens'][0]['caixa_xyxyn'], [0.1, 0.1, 0.9, 0.9])
            self.assertEqual(dados['deteccao_lesoes'], {'estado': 'nao_disponivel', 'itens': []})
            self.assertFalse(self.detector.predict.call_args.kwargs['save'])

    def test_sem_folha_nao_classifica_nem_reaproveita_resultado_anterior(self):
        with self.cliente() as cliente:
            self.assertEqual(self.enviar(cliente).status_code, 200)
            self.classificador.predict.reset_mock()
            self.detector.predict.return_value = [resultado_caixas([])]
            resposta = self.enviar(cliente)
            self.assertEqual(resposta.status_code, 422)
            self.assertIsInstance(resposta.json()['detail'], str)
            self.classificador.predict.assert_not_called()

    def test_folhas_distintas_sao_ambiguas_e_caixas_repetidas_nao(self):
        with self.cliente() as cliente:
            self.detector.predict.return_value = [resultado_caixas([[0, 0, 80, 100], [120, 0, 200, 100]])]
            self.assertEqual(self.enviar(cliente).status_code, 422)
            self.detector.predict.return_value = [resultado_caixas([[20, 10, 180, 90], [21, 11, 179, 89]])]
            self.assertEqual(len(self.enviar(cliente).json()['deteccao_folha']['itens']), 1)

    def test_orientacao_exif_aplicada_antes_da_deteccao(self):
        with self.cliente() as cliente:
            self.detector.predict.return_value = [resultado_caixas([[10, 20, 90, 180]])]
            dados = self.enviar(cliente, self.foto(orientacao=6)).json()
            self.assertEqual(dados['imagem'], {'largura': 100, 'altura': 200})
            self.assertEqual(dados['deteccao_folha']['itens'][0]['caixa_xyxyn'], [0.1, 0.1, 0.9, 0.9])
            self.assertEqual(self.detector.predict.call_args.kwargs['source'].size, (100, 200))

    def test_caixas_sao_limitadas_ao_tamanho_da_imagem(self):
        with self.cliente() as cliente:
            self.detector.predict.return_value = [resultado_caixas([[-20, -10, 220, 110]])]
            dados = self.enviar(cliente).json()
            self.assertEqual(dados['deteccao_folha']['itens'][0]['caixa_xyxyn'], [0, 0, 1, 1])

    def test_erro_no_detector_de_folha_nao_parece_ausencia_de_folha(self):
        with self.cliente() as cliente:
            self.detector.predict.side_effect = RuntimeError('Falha simulada')
            self.assertEqual(self.enviar(cliente).status_code, 500)

    def test_lesoes_concluidas_nao_sao_confundidas_com_classificacao(self):
        with self.cliente(lesoes=True) as cliente:
            dados = self.enviar(cliente).json()
            self.assertEqual(dados['classe'], 'healthy')
            self.assertEqual(dados['deteccao_lesoes']['estado'], 'concluido')
            self.assertEqual(dados['deteccao_lesoes']['itens'][0]['classe'], 'lesao')
            self.lesoes.predict.return_value = [resultado_caixas([], 'lesao')]
            self.assertEqual(self.enviar(cliente).json()['deteccao_lesoes'], {'estado': 'concluido', 'itens': []})

    def test_falha_parcial_de_lesoes_preserva_classificacao(self):
        with self.cliente(lesoes=True) as cliente:
            self.lesoes.predict.side_effect = RuntimeError('Falha simulada')
            resposta = self.enviar(cliente)
            self.assertEqual(resposta.status_code, 200)
            self.assertEqual(resposta.json()['deteccao_lesoes'], {'estado': 'erro', 'itens': []})
            self.assertEqual(resposta.json()['classe'], 'healthy')

    def test_peso_de_folhas_nao_pode_ser_usado_para_lesoes(self):
        self.lesoes.names = {0: 'folha'}
        with self.assertRaisesRegex(RuntimeError, 'classe lesao'):
            with self.cliente(lesoes=True):
                pass

    def test_validacao_de_arquivos_preservada(self):
        with self.cliente() as cliente:
            for conteudo, status in [(b'', 400), (b'invalido', 400), (b'x' * (api.MAX_BYTES + 1), 413), (self.foto('BMP'), 415)]:
                with self.subTest(status=status):
                    self.assertEqual(self.enviar(cliente, conteudo).status_code, status)
            self.assertEqual(cliente.post('/analisar').status_code, 422)
            for formato in ['JPEG', 'PNG', 'WEBP']:
                self.assertEqual(self.enviar(cliente, self.foto(formato)).status_code, 200)


if __name__ == '__main__':
    main()
