package main

import (
	"encoding/json"
	"fmt"
	tlsclient "github.com/bogdanfinn/tls-client"
	"github.com/bogdanfinn/tls-client/profiles"
	"github.com/go-resty/resty/v2"
	srt "github.com/juzeon/spoofed-round-tripper"
	"log"
	"os"
)

const MAX_LOG_LENGTH = 500

type Input struct {
	Message string `json:"message"`
}

func main() {
	var input Input
	if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v", err)
		os.Exit(1)
	}
	// 创建伪造TLS指纹的RoundTripper
	tr, err := srt.NewSpoofedRoundTripper(
		tlsclient.WithRandomTLSExtensionOrder(),
		tlsclient.WithClientProfile(profiles.Chrome_120),
	)
	if err != nil {
		log.Fatalf("创建RoundTripper失败: %v", truncateError(err))
	}

	// 创建Resty客户端并设置
	client := resty.New().SetTransport(tr).
		SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36").
		SetHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")

	// 发送请求
	resp, err := client.R().Get(`https://zh.minecraft.wiki/w/` + input.Message)
	if err != nil {
		log.Fatalf("请求失败: %v", truncateError(err))
	}

	// 检查响应状态码
	if resp.StatusCode() != 200 {
		log.Fatalf("非200状态码: %d", resp.StatusCode())
	}

	// 处理响应内容
	body := resp.String()
	fmt.Println("请求成功! 内容预览:")
	fmt.Println(body)

	json.NewEncoder(os.Stdout).Encode(body)
}

// 截断错误信息
func truncateError(err error) string {
	errStr := err.Error()
	if len(errStr) > MAX_LOG_LENGTH {
		return errStr[:MAX_LOG_LENGTH] + "..."
	}
	return errStr
}
