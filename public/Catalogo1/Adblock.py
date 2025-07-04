import os
import re

def adicionar_sandbox_em_js():
    pasta = os.path.dirname(os.path.abspath(__file__))
    arquivos_js = [f for f in os.listdir(pasta) if f.endswith('.js')]
    print(f"Arquivos JS encontrados: {arquivos_js}")

    for arquivo in arquivos_js:
        caminho = os.path.join(pasta, arquivo)
        with open(caminho, 'r', encoding='utf-8') as f:
            linhas = f.readlines()

        novo_codigo = []
        i = 0
        modificado = False

        while i < len(linhas):
            linha = linhas[i]
            novo_codigo.append(linha)

            # Detecta criação de iframe: document.createElement('iframe')
            m = re.search(r'document\.createElement\([\'"]iframe[\'"]\)', linha)
            if m:
                # Tenta pegar o nome da variável (ex: const iframe = document.createElement('iframe');)
                m_var = re.search(r'(\w+)\s*=\s*document\.createElement\([\'"]iframe[\'"]\)', linha)
                if m_var:
                    var_nome = m_var.group(1)
                    # Insere a linha de sandbox logo após
                    linha_sandbox = f'{var_nome}.setAttribute("sandbox", "allow-scripts allow-same-origin");\n'
                    novo_codigo.append(linha_sandbox)
                    modificado = True
            else:
                # Também procura por strings com iframes e adiciona sandbox se não tiver
                # Exemplo: '<iframe src="...">'
                pattern = r'(<iframe\b(?![^>]*sandbox)[^>]*>)'
                if re.search(pattern, linha, re.IGNORECASE):
                    def replace_iframe_tag(match):
                        tag = match.group(1)
                        # Insere sandbox antes do fechamento
                        if 'sandbox=' in tag.lower():
                            return tag
                        else:
                            return tag[:-1] + ' sandbox="allow-scripts allow-same-origin">'
                    nova_linha = re.sub(pattern, replace_iframe_tag, linha, flags=re.IGNORECASE)
                    if nova_linha != linha:
                        novo_codigo[-1] = nova_linha
                        modificado = True

            i += 1

        if modificado:
            with open(caminho, 'w', encoding='utf-8') as f:
                f.writelines(novo_codigo)
            print(f"[✔] Modificado: {arquivo}")
        else:
            print(f"[=] Nenhuma modificação necessária em: {arquivo}")

if __name__ == "__main__":
    adicionar_sandbox_em_js()
