# Makefile for cross-compiling Go application
BINARY_NAME := fetch_wiki
BUILD_DIR := bin
PLATFORMS := windows/amd64 darwin/amd64 darwin/arm64 linux/amd64

# 默认构建当前平台
build:
	go build -o $(BUILD_DIR)/$(BINARY_NAME) .

# 跨平台编译所有目标
build-all:
	@for platform in $(PLATFORMS); do \
		GOOS=$${platform%/*}; \
		GOARCH=$${platform#*/}; \
		OUTPUT="$(BUILD_DIR)/$(BINARY_NAME)-$$GOOS-$$GOARCH"; \
		[ "$$GOOS" = "windows" ] && OUTPUT="$$OUTPUT.exe"; \
		echo "Building for $$GOOS/$$GOARCH..."; \
		CGO_ENABLED=0 GOOS=$$GOOS GOARCH=$$GOARCH go build -o $$OUTPUT .; \
	done

# 清理构建文件
clean:
	rm -rf $(BUILD_DIR)

# 伪目标声明
.PHONY: build build-all clean
