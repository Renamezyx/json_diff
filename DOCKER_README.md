# 使用Docker部署Online JSON Diff

这个项目已经配置好了Docker环境，可以轻松部署到任何支持Docker的环境中。

## 前提条件

- 安装 [Docker](https://docs.docker.com/get-docker/)
- 安装 [Docker Compose](https://docs.docker.com/compose/install/)

## 部署步骤

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/online-json-diff.git
cd online-json-diff
```

2. 使用Docker Compose构建和启动容器：

```bash
docker-compose up -d
```

3. 访问应用：

打开浏览器，访问 http://localhost:3000

## 停止应用

```bash
docker-compose down
```

## 重新构建

如果代码有更新，需要重新构建镜像：

```bash
docker-compose up -d --build
```

## 查看日志

```bash
docker-compose logs -f
``` 