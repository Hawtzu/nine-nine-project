# nine-nine-project ガイド

Web applicationプロジェクトの開発ガイドです。

## プロジェクト概要

- **プロジェクト名**: nine-nine-project
- **説明**: Web application
- **使用技術**: 未定

## 開発方針

- コードの可読性を重視する
- 適切なコメントを記述する
- テストを書いて品質を保つ

## GitHub Actions連携

このプロジェクトでは、Claude Code GitHub Actionsを使用して、PR内で自動的にコード生成やレビューを行います。

### 使い方

PR内のコメントで `@claude` とメンションすることで、Claudeが自動的に応答します。

**例：**
- `@claude この機能を実装してください`
- `@claude バグを修正してください`
- `@claude /review` - コードレビューを実行

## コーディング規約

- 変数名は camelCase を使用
- 関数には適切なコメントを付ける
- エラーハンドリングを適切に行う

## その他

質問や改善案があれば、気軽に相談してください。
