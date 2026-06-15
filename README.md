# PDF Translation Study Tool

[English](README.en.md)

アップロードしたPDFを解析・翻訳し、学習用HTMLとしてダウンロードできる静的ブラウザアプリです。
Gemini APIの呼び出しは利用者のブラウザから直接行い、利用者自身のGemini Keyを使います。

## スコープ

このフォルダは単独で動作するプロジェクトです。実行時に親ワークスペースへ依存しません。

## 開発

```powershell
npm test
npm start
```

現在のMVPは静的ホスティングで動作する構成です。サーバー側のAPIやビルド工程は不要です。

## 静的ホスティング

`src/` ディレクトリを静的ファイルとして配信してください。現在のMVPではビルドステップは不要です。

## GitHub Pages

このリポジトリにはGitHub Pages用のGitHub Actions workflowが含まれています。
workflowはテストを実行したあと、`src/` ディレクトリをそのままデプロイします。

1. このリポジトリをGitHubへpushします。
2. GitHubで `Settings` -> `Pages` を開きます。
3. `Build and deployment` の `Source` を `GitHub Actions` に設定します。
4. `main` にpushするか、`Actions` タブから `Deploy GitHub Pages` workflowを手動実行します。

アプリは相対パスでアセットを読み込むため、`https://USER.github.io/REPOSITORY/` のようなプロジェクトPages URLでも動作します。
