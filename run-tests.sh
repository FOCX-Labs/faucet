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

# Install dependencies
install_dependencies() {
    print_info "Installing project dependencies..."
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Dependencies installation completed"
    else
        print_info "Dependencies already exist, skipping installation"
    fi
}

# Build project
build_project() {
    print_info "Building Anchor project..."
    
    if [ ! -f "target/deploy/faucet.so" ] || [ ! -f "target/idl/faucet.json" ]; then
        anchor build
        print_success "Project build completed"
    else
        print_info "Project already built, skipping build step"
    fi
}

# Check wallet
check_wallet() {
    print_info "Checking wallet configuration..."
    
    WALLET_PATH="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
    
    if [ ! -f "$WALLET_PATH" ]; then
        print_warning "Wallet file does not exist: $WALLET_PATH"
        print_info "Generating new wallet..."
        
        mkdir -p "$(dirname "$WALLET_PATH")"
        solana-keygen new --outfile "$WALLET_PATH" --no-bip39-passphrase
        print_success "Wallet generation completed: $WALLET_PATH"
    else
        print_success "Wallet file exists: $WALLET_PATH"
    fi
    
    # Set environment variables
    export ANCHOR_WALLET="$WALLET_PATH"
}

# Check network connection
check_network() {
    print_info "Checking network connection..."
    
    # Set default RPC endpoint
    export ANCHOR_PROVIDER_URL="${ANCHOR_PROVIDER_URL:-https://api.devnet.solana.com}"
    
    print_info "Using RPC endpoint: $ANCHOR_PROVIDER_URL"
    
    # Test network connection
    if command -v solana &> /dev/null; then
        solana config set --url "$ANCHOR_PROVIDER_URL" > /dev/null 2>&1
        if solana cluster-version > /dev/null 2>&1; then
            print_success "Network connection normal"
        else
            print_warning "Network connection may have issues, but will continue to try running tests"
        fi
    fi
}

# Run tests
run_tests() {
    print_info "Starting end-to-end tests..."
    echo ""
    
    # Set environment variables
    export NODE_TLS_REJECT_UNAUTHORIZED=0
    export RUST_LOG=error  # Reduce log output
    
    # Run tests
    if npm run test:e2e; then
        echo ""
        print_success "All tests passed!"
        
        # Check if test report was generated
        if [ -f "test-report.md" ]; then
            print_info "Test report generated: test-report.md"
        fi
        
        return 0
    else
        echo ""
        print_error "Tests failed!"
        return 1
    fi
}

# Cleanup function
cleanup() {
    print_info "Cleaning up temporary files..."
    # Cleanup logic can be added here
}

# Show help information
show_help() {
    echo "Solana Faucet E2E Test Runner"
    echo ""
    echo "Usage:"
    echo "  ./run-tests.sh [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help information"
    echo "  -q, --quick    Quick mode (skip dependency checks)"
    echo "  -c, --clean    Clean mode (rebuild)"
    echo "  -v, --verbose  Verbose output mode"
    echo ""
    echo "Environment variables:"
    echo "  ANCHOR_PROVIDER_URL  Solana RPC endpoint (default: https://api.devnet.solana.com)"
    echo "  ANCHOR_WALLET        Wallet file path (default: ~/.config/solana/id.json)"
    echo "  HTTP_PROXY          HTTP proxy settings"
    echo "  HTTPS_PROXY         HTTPS proxy settings"
    echo ""
    echo "Examples:"
    echo "  ./run-tests.sh                    # Run complete tests"
    echo "  ./run-tests.sh --quick            # Quick run tests"
    echo "  ./run-tests.sh --clean            # Clean and run tests"
    echo ""
}

# Main function
main() {
    local quick_mode=false
    local clean_mode=false
    local verbose_mode=false
    
    # Parse command line arguments
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
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Set verbose output
    if [ "$verbose_mode" = true ]; then
        set -x
    fi
    
    # Clean mode
    if [ "$clean_mode" = true ]; then
        print_info "Clean mode: deleting build files..."
        rm -rf target/
        rm -rf node_modules/
    fi
    
    print_header
    
    # Register cleanup function
    trap cleanup EXIT
    
    # Execute checks and preparation steps
    if [ "$quick_mode" = false ]; then
        check_dependencies
        install_dependencies
        build_project
        check_wallet
        check_network
    else
        print_info "Quick mode: skipping dependency checks"
        install_dependencies
    fi
    
    echo ""
    print_info "Preparation completed, starting test execution..."
    echo ""
    
    # Run tests
    if run_tests; then
        echo ""
        print_success "Test execution completed!"
        exit 0
    else
        echo ""
        print_error "Test execution failed!"
        exit 1
    fi
}

# Check if this script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
