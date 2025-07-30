use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_lang::system_program::{transfer, Transfer as SystemTransfer};

declare_id!("3JtTpsLxSAYZweorwjU9cywAFLm8BUonGwQ54gqFnAGg");

#[program]
pub mod faucet {
    use super::*;

    // Initialize faucet
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let faucet = &mut ctx.accounts.faucet;
        faucet.authority = ctx.accounts.authority.key();
        faucet.token_mint = ctx.accounts.token_mint.key();
        faucet.token_account = ctx.accounts.token_account.key();
        faucet.bump = ctx.bumps.faucet;
        
        msg!("Faucet initialized successfully!");
        msg!("Token Mint: {}", faucet.token_mint);
        msg!("Token Account: {}", faucet.token_account);
        
        Ok(())
    }

    // Users deposit SOL to receive USDC-FOCX
    pub fn exchange_sol_for_tokens(ctx: Context<ExchangeSolForTokens>, amount: u64) -> Result<()> {
        let faucet = &ctx.accounts.faucet;
        let user = &ctx.accounts.user;
        let user_token_account = &ctx.accounts.user_token_account;
        let faucet_token_account = &ctx.accounts.faucet_token_account;
        let system_program = &ctx.accounts.system_program;
        let token_program = &ctx.accounts.token_program;

        // Validate faucet account
        require!(
            faucet.authority == ctx.accounts.authority.key(),
            FaucetError::InvalidAuthority
        );

        // Calculate exchange rate: 1 SOL = 10000 USDC-FOCX
        let exchange_rate = 10000;
        let token_amount = amount * exchange_rate;

        // Check if faucet has sufficient tokens
        let faucet_balance = faucet_token_account.amount;
        require!(
            faucet_balance >= token_amount,
            FaucetError::InsufficientTokens
        );

        // Transfer SOL to faucet's SOL account
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &user.key(),
            &faucet.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                user.to_account_info(),
                faucet.to_account_info(),
                system_program.to_account_info(),
            ],
        )?;

        // Transfer tokens to user
        let seeds = &[
            b"faucet".as_ref(),
            &[faucet.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: faucet_token_account.to_account_info(),
            to: user_token_account.to_account_info(),
            authority: faucet.to_account_info(),
        };

        let cpi_program = token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, token_amount)?;

        msg!("Exchange successful!");
        msg!("SOL received: {}", amount);
        msg!("USDC-FOCX sent: {}", token_amount);

        Ok(())
    }

    // Administrator withdraw SOL
    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        let faucet = &ctx.accounts.faucet;
        let authority = &ctx.accounts.authority;
        let recipient = &ctx.accounts.recipient;

        // Validate permissions
        require!(
            faucet.authority == authority.key(),
            FaucetError::InvalidAuthority
        );

        // Check balance
        let faucet_balance = faucet.to_account_info().lamports();
        require!(
            faucet_balance >= amount,
            FaucetError::InsufficientSol
        );

        // Transfer SOL
        let seeds = &[
            b"faucet".as_ref(),
            &[faucet.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = SystemTransfer {
            from: faucet.to_account_info(),
            to: recipient.to_account_info(),
        };

        let cpi_program = ctx.accounts.system_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        transfer(cpi_ctx, amount)?;

        msg!("SOL withdrawn successfully!");
        msg!("Amount: {}", amount);

        Ok(())
    }

    // Administrator withdraw tokens
    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, amount: u64) -> Result<()> {
        let faucet = &ctx.accounts.faucet;
        let authority = &ctx.accounts.authority;
        let faucet_token_account = &ctx.accounts.faucet_token_account;
        let recipient_token_account = &ctx.accounts.recipient_token_account;

        // Validate permissions
        require!(
            faucet.authority == authority.key(),
            FaucetError::InvalidAuthority
        );

        // Check token balance
        require!(
            faucet_token_account.amount >= amount,
            FaucetError::InsufficientTokens
        );

        // Transfer tokens
        let seeds = &[
            b"faucet".as_ref(),
            &[faucet.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: faucet_token_account.to_account_info(),
            to: recipient_token_account.to_account_info(),
            authority: faucet.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        msg!("Tokens withdrawn successfully!");
        msg!("Amount: {}", amount);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Faucet::INIT_SPACE,
        seeds = [b"faucet"],
        bump
    )]
    pub faucet: Account<'info, Faucet>,
    
    /// CHECK: This is the authority that can manage the faucet
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        constraint = token_account.mint == token_mint.key(),
        constraint = token_account.owner == faucet.key()
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ExchangeSolForTokens<'info> {
    #[account(
        seeds = [b"faucet"],
        bump = faucet.bump,
        constraint = faucet.token_mint == token_mint.key()
    )]
    pub faucet: Account<'info, Faucet>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        constraint = user_token_account.mint == token_mint.key(),
        constraint = user_token_account.owner == user.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = faucet_token_account.mint == token_mint.key(),
        constraint = faucet_token_account.owner == faucet.key()
    )]
    pub faucet_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is the authority that can manage the faucet
    pub authority: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(
        seeds = [b"faucet"],
        bump = faucet.bump
    )]
    pub faucet: Account<'info, Faucet>,
    
    /// CHECK: This is the authority that can manage the faucet
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(
        seeds = [b"faucet"],
        bump = faucet.bump,
        constraint = faucet.token_mint == token_mint.key()
    )]
    pub faucet: Account<'info, Faucet>,
    
    /// CHECK: This is the authority that can manage the faucet
    pub authority: Signer<'info>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        constraint = faucet_token_account.mint == token_mint.key(),
        constraint = faucet_token_account.owner == faucet.key()
    )]
    pub faucet_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = recipient_token_account.mint == token_mint.key(),
        constraint = recipient_token_account.owner == authority.key()
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Faucet {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_account: Pubkey,
    pub bump: u8,
}

#[error_code]
pub enum FaucetError {
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Insufficient tokens in faucet")]
    InsufficientTokens,
    #[msg("Insufficient SOL in faucet")]
    InsufficientSol,
} 