#!/usr/bin/env python3
"""Genera todo-en-uno.html y captura.html a partir de panel.html.
Ejecutar desde cualquier lugar cada vez que se cambie panel.html:  python tools/generar-paginas.py"""
import os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
base = open('panel.html', encoding='utf-8').read()

def variante(titulo, layout):
    t = base.replace('<title>Alineaciones · Panel</title>', '<title>Alineaciones · ' + titulo + '</title>')
    t = t.replace('<link rel="stylesheet" href="css/panel.css">',
                  '<link rel="stylesheet" href="css/panel.css">\n  <link rel="stylesheet" href="css/embed.css">')
    flags = "window.LU_EMBED = true; window.LU_EMBED_LAYOUT = '" + layout + "';"
    t = t.replace('<script src="js/config.js"></script>', '<script>' + flags + '</script>\n<script src="js/config.js"></script>')
    assert 'embed.css' in t and 'LU_EMBED' in t
    return t

open('todo-en-uno.html', 'w', encoding='utf-8').write(variante('Todo en uno', 'auto'))
open('captura.html', 'w', encoding='utf-8').write(variante('Captura de ventana', 'ventana'))
print('listo: todo-en-uno.html (auto) y captura.html (ventana)')
