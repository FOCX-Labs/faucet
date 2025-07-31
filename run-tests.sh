#!/bin/bash

# Solana Faucet E2E Test Quick Runner Script
# Usage: ./run-tests.sh [options]

set -e  # Exit on error

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "🚀 Solana Faucet E2E Test Runner"
    echo "=================================================="
    echo -e "${NC}"
}

# Check dependencies
check_dependencies() {
    print_info "Checking system dependencies..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed, please install Node.js first"
        exit 1
    fi
    print_success "Node.js version: $(node --version)"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm version: $(npm --version)"

    # Check Solana CLI
    if ! command -v solana &> /dev/null; then
        print_warning "Solana CLI is not installed, some features may not be available"
    else
        print_success "Solana CLI version: $(solana --version)"
    fi

    # Check Anchor CLI
    if ! command -v anchor &> /dev/null; then
        print_warning "Anchor CLI is not installed, please run: npm install -g @coral-xyz/anchor-cli"
    else
        print_success "Anchor CLI version: $(anchor --version)"
    fi
}

# 安装依赖
install_dependencies() {
    print_info "安装项目依赖..."
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "依赖安装完成"
    else
        print_info "依赖已存在，跳过安装"
    fi
}

# 构建项目
build_project() {
    print_info "构建 Anchor 项目..."
    
    if [ ! -f "target/deploy/faucet.so" ] || [ ! -f "target/idl/faucet.json" ]; then
        anchor build
        print_success "项目构建完成"
    else
        print_info "项目已构建，跳过构建步骤"
    fi
}

# 检查钱包
check_wallet() {
    print_info "检查钱包配置..."
    
    WALLET_PATH="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
    
    if [ ! -f "$WALLET_PATH" ]; then
        print_warning "钱包文件不存在: $WALLET_PATH"
        print_info "正在生成新钱包..."
        
        mkdir -p "$(dirname "$WALLET_PATH")"
        solana-keygen new --outfile "$WALLET_PATH" --no-bip39-passphrase
        print_success "钱包生成完成: $WALLET_PATH"
    else
        print_success "钱包文件存在: $WALLET_PATH"
    fi
    
    # 设置环境变量
    export ANCHOR_WALLET="$WALLET_PATH"
}

# 检查网络连接
check_network() {
    print_info "检查网络连接..."
    
    # 设置默认 RPC 端点
    export ANCHOR_PROVIDER_URL="${ANCHOR_PROVIDER_URL:-https://api.devnet.solana.com}"
    
    print_info "使用 RPC 端点: $ANCHOR_PROVIDER_URL"
    
    # 测试网络连接
    if command -v solana &> /dev/null; then
        solana config set --url "$ANCHOR_PROVIDER_URL" > /dev/null 2>&1
        if solana cluster-version > /dev/null 2>&1; then
            print_success "网络连接正常"
        else
            print_warning "网络连接可能有问题，但将继续尝试运行测试"
        fi
    fi
}

# 运行测试
run_tests() {
    print_info "开始运行端到端测试..."
    echo ""
    
    # 设置环境变量
    export NODE_TLS_REJECT_UNAUTHORIZED=0
    export RUST_LOG=error  # 减少日志输出
    
    # 运行测试
    if npm run test:e2e; then
        echo ""
        print_success "所有测试通过！"
        
        # 检查是否生成了测试报告
        if [ -f "test-report.md" ]; then
            print_info "测试报告已生成: test-report.md"
        fi
        
        return 0
    else
        echo ""
        print_error "测试失败！"
        return 1
    fi
}

# 清理函数
cleanup() {
    print_info "清理临时文件..."
    # 这里可以添加清理逻辑
}

# 显示帮助信息
show_help() {
    echo "Solana Faucet E2E 测试运行器"
    echo ""
    echo "使用方法:"
    echo "  ./run-tests.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  -q, --quick    快速模式（跳过依赖检查）"
    echo "  -c, --clean    清理模式（重新构建）"
    echo "  -v, --verbose  详细输出模式"
    echo ""
    echo "环境变量:"
    echo "  ANCHOR_PROVIDER_URL  Solana RPC 端点 (默认: https://api.devnet.solana.com)"
    echo "  ANCHOR_WALLET        钱包文件路径 (默认: ~/.config/solana/id.json)"
    echo "  HTTP_PROXY           HTTP 代理设置"
    echo "  HTTPS_PROXY          HTTPS 代理设置"
    echo ""
    echo "示例:"
    echo "  ./run-tests.sh                    # 运行完整测试"
    echo "  ./run-tests.sh --quick            # 快速运行测试"
    echo "  ./run-tests.sh --clean            # 清理后运行测试"
    echo ""
}

# 主函数
main() {
    local quick_mode=false
    local clean_mode=false
    local verbose_mode=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -q|--quick)
                quick_mode=true
                shift
                ;;
            -c|--clean)
                clean_mode=true
                shift
                ;;
            -v|--verbose)
                verbose_mode=true
                shift
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 设置详细输出
    if [ "$verbose_mode" = true ]; then
        set -x
    fi
    
    # 清理模式
    if [ "$clean_mode" = true ]; then
        print_info "清理模式：删除构建文件..."
        rm -rf target/
        rm -rf node_modules/
    fi
    
    print_header
    
    # 注册清理函数
    trap cleanup EXIT
    
    # 执行检查和准备步骤
    if [ "$quick_mode" = false ]; then
        check_dependencies
        install_dependencies
        build_project
        check_wallet
        check_network
    else
        print_info "快速模式：跳过依赖检查"
        install_dependencies
    fi
    
    echo ""
    print_info "准备工作完成，开始运行测试..."
    echo ""
    
    # 运行测试
    if run_tests; then
        echo ""
        print_success "测试运行完成！"
        exit 0
    else
        echo ""
        print_error "测试运行失败！"
        exit 1
    fi
}

# 检查是否直接运行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
