# かんたん公文書XMLブラウザ

フォルダ内のXMLファイルをリスト表示し、選択したファイルの内容を表示します。
XSLファイルがある場合は、それを使用してXMLを整形して表示します。

## 必要な環境

- Python 3.8以上

## インストール方法

### 1. Pythonのインストール

Pythonがインストールされていない場合：

1. [Python公式サイト](https://www.python.org/downloads/)からPythonをダウンロード
2. インストール時に「Add Python to PATH」にチェックを入れる
3. インストールを完了

### 2. 必要なパッケージのインストール

コマンドプロンプトまたはPowerShellで、このフォルダに移動して以下を実行：

```bash
pip install -r requirements.txt
```

または個別にインストール：

```bash
pip install PySide6
pip install lxml
```

## 実行方法

```bash
python xml_viewer.py
```

または

```bash
py xml_viewer.py
```

## 機能

- フォルダまたはZIPファイルからXMLファイルを読み込み
- XMLファイルの一覧表示
- XSLファイルがある場合は自動的に適用して表示
- ドラッグ&ドロップ対応
- 印刷・PDF保存機能

## ライセンス

- PySide6: LGPL v3.0
- PySide6-WebEngine: LGPL v3.0
- lxml: BSD License
- Python標準ライブラリ: PSF License

