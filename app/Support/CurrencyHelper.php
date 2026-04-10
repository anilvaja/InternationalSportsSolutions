<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Auth;

class CurrencyHelper
{
    protected static array $currencies = [
        'INR' => ['symbol' => '₹', 'name' => 'Indian Rupee', 'code' => 'INR'],
        'USD' => ['symbol' => '$', 'name' => 'US Dollar', 'code' => 'USD'],
        'EUR' => ['symbol' => '€', 'name' => 'Euro', 'code' => 'EUR'],
        'GBP' => ['symbol' => '£', 'name' => 'British Pound', 'code' => 'GBP'],
        'AED' => ['symbol' => 'د.إ', 'name' => 'UAE Dirham', 'code' => 'AED'],
        'CAD' => ['symbol' => 'C$', 'name' => 'Canadian Dollar', 'code' => 'CAD'],
        'AUD' => ['symbol' => 'A$', 'name' => 'Australian Dollar', 'code' => 'AUD'],
        'SGD' => ['symbol' => 'S$', 'name' => 'Singapore Dollar', 'code' => 'SGD'],
    ];

    /**
     * Get the current academy's default currency
     */
    public static function getAcademyCurrency(): string
    {
        return Setting::get('default_currency', 'INR');
    }

    /**
     * Get currency symbol for the current academy
     */
    public static function getAcademyCurrencySymbol(): string
    {
        $currency = static::getAcademyCurrency();
        return static::$currencies[$currency]['symbol'] ?? '₹';
    }

    /**
     * Get currency name for the current academy
     */
    public static function getAcademyCurrencyName(): string
    {
        $currency = static::getAcademyCurrency();
        return static::$currencies[$currency]['name'] ?? 'Indian Rupee';
    }

    /**
     * Format amount with academy currency
     */
    public static function format(float $amount, ?string $currency = null): string
    {
        $currency = $currency ?? static::getAcademyCurrency();
        $symbol = static::$currencies[$currency]['symbol'] ?? '₹';
        
        return $symbol . ' ' . number_format($amount, 2);
    }

    /**
     * Get all available currencies
     */
    public static function getAllCurrencies(): array
    {
        return static::$currencies;
    }

    /**
     * Get currency options for select fields
     */
    public static function getCurrencyOptions(): array
    {
        $options = [];
        foreach (static::$currencies as $code => $details) {
            $options[$code] = "{$details['name']} ({$details['symbol']})";
        }
        return $options;
    }

    /**
     * Get exchange rate from base currency to target currency
     */
    public static function getExchangeRate(string $fromCurrency, string $toCurrency): float
    {
        if ($fromCurrency === $toCurrency) {
            return 1.0;
        }

        $cacheKey = "exchange_rate_{$fromCurrency}_{$toCurrency}";
        $rate = Setting::get($cacheKey, null);

        if ($rate === null) {
            // Default exchange rates (you can integrate with live API later)
            $rate = static::getDefaultExchangeRate($fromCurrency, $toCurrency);
        }

        return (float) $rate;
    }

    /**
     * Convert amount from one currency to another
     */
    public static function convert(float $amount, string $fromCurrency, string $toCurrency): float
    {
        if ($fromCurrency === $toCurrency) {
            return $amount;
        }

        $rate = static::getExchangeRate($fromCurrency, $toCurrency);
        return round($amount * $rate, 16); // Keep 16 decimal precision for internal calculations
    }

    /**
     * Set exchange rate between two currencies
     */
    public static function setExchangeRate(string $fromCurrency, string $toCurrency, float $rate): void
    {
        $cacheKey = "exchange_rate_{$fromCurrency}_{$toCurrency}";
        // Store with high precision (16 decimal places)
        Setting::set($cacheKey, number_format($rate, 16, '.', ''), 'string', 'exchange_rates');
        
        // Also set the reverse rate with high precision
        $reverseCacheKey = "exchange_rate_{$toCurrency}_{$fromCurrency}";
        $reverseRate = 1 / $rate;
        Setting::set($reverseCacheKey, number_format($reverseRate, 16, '.', ''), 'string', 'exchange_rates');
    }

    /**
     * Get default exchange rates (fallback values)
     */
    public static function getDefaultExchangeRate(string $fromCurrency, string $toCurrency): float
    {
        // Default exchange rates relative to USD (with high precision)
        $usdRates = [
            'INR' => 83.1234567890123456,  // 1 USD = 83.1234567890123456 INR
            'USD' => 1.0,                  // Base currency
            'EUR' => 0.8512345678901234,   // 1 USD = 0.8512345678901234 EUR
            'GBP' => 0.7312345678901234,   // 1 USD = 0.7312345678901234 GBP
            'AED' => 3.6731234567890123,   // 1 USD = 3.6731234567890123 AED
            'CAD' => 1.3512345678901234,   // 1 USD = 1.3512345678901234 CAD
            'AUD' => 1.5012345678901234,   // 1 USD = 1.5012345678901234 AUD
            'SGD' => 1.3512345678901234,   // 1 USD = 1.3512345678901234 SGD
        ];

        $fromRate = $usdRates[$fromCurrency] ?? 1.0;
        $toRate = $usdRates[$toCurrency] ?? 1.0;

        // Convert: fromCurrency -> USD -> toCurrency
        return $toRate / $fromRate;
    }

    /**
     * Get all exchange rates for current academy currency
     */
    public static function getAcademyExchangeRates(): array
    {
        $baseCurrency = static::getAcademyCurrency();
        $rates = [];

        foreach (array_keys(static::$currencies) as $currency) {
            if ($currency !== $baseCurrency) {
                $rates[$currency] = static::getExchangeRate($baseCurrency, $currency);
            }
        }

        return $rates;
    }

    /**
     * Format exchange rate for display (removes trailing zeros)
     */
    public static function formatExchangeRate(float $rate): string
    {
        // Format with 16 decimal places, then remove trailing zeros
        $formatted = number_format($rate, 16, '.', '');
        $formatted = rtrim($formatted, '0');
        $formatted = rtrim($formatted, '.');
        
        return $formatted;
    }

    /**
     * Convert display value with proper precision for calculations
     */
    public static function convertWithPrecision(float $amount, string $fromCurrency, string $toCurrency, int $displayDecimals = 2): array
    {
        if ($fromCurrency === $toCurrency) {
            return [
                'converted_amount' => $amount,
                'display_amount' => number_format($amount, $displayDecimals),
                'exchange_rate' => 1.0,
                'formatted_rate' => '1.0'
            ];
        }

        $rate = static::getExchangeRate($fromCurrency, $toCurrency);
        $convertedAmount = $amount * $rate;
        
        return [
            'converted_amount' => $convertedAmount,
            'display_amount' => number_format($convertedAmount, $displayDecimals),
            'exchange_rate' => $rate,
            'formatted_rate' => static::formatExchangeRate($rate)
        ];
    }
}
