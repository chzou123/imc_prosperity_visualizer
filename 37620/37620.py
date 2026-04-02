import jsonpickle
import math
import statistics
import pandas as pd
import numpy as np
from typing import List, Dict, Any

from datamodel import OrderDepth, TradingState, Order

class Trader:
    
    # Globally stick to a limit of 20 units for this implementation
    LIMIT = 20
    
    # Tomatoes Strategy Parameters
    TOMATOES_ALPHA = 0.1
    TOMATOES_SPREAD_THRESHOLD = 1.5   # Triggers trades if deviation > this

    def run(self, state: TradingState) -> tuple[Dict[str, List[Order]], int, str]:
        """
        Only method required. It takes all inputs and outputs a list of outputs.
        """
        # Load previous history from traderData
        trader_data = state.traderData
        bot_state = {}
        if trader_data and trader_data != "":
            try:
                bot_state = jsonpickle.decode(trader_data)
            except Exception:
                bot_state = {}
        
        # Initialize missing state variables
        if 'tomatoes_ewma' not in bot_state:
            bot_state['tomatoes_ewma'] = None

        result = {}
        
        for product in state.order_depths:
            order_depth: OrderDepth = state.order_depths[product]
            pos = state.position.get(product, 0)
            
            if product == "EMERALDS":
                result[product] = self.trade_emeralds(order_depth, pos)
            elif product == "TOMATOES":
                orders, new_ewma = self.trade_tomatoes(order_depth, pos, bot_state['tomatoes_ewma'])
                result[product] = orders
                bot_state['tomatoes_ewma'] = new_ewma
                
        # String value below will be saved as state.traderData for the next execution
        trader_state_str = jsonpickle.encode(bot_state)

        # Conversions are not used in this round
        conversions = 0
        return result, conversions, trader_state_str


    # ── EMERALDS STRATEGY ────────────────────────────────────────────────
    def trade_emeralds(self, order_depth: OrderDepth, pos: int) -> List[Order]:
        orders: List[Order] = []
        FV = 10000

        # 1. Take anything mispriced vs Fair Value (10,000)
        # Sell orders (Asks) that are underpriced -> We Buy these!
        if len(order_depth.sell_orders) > 0:
            for ask_price, ask_vol in sorted(order_depth.sell_orders.items()):
                if ask_price < FV and pos < self.LIMIT:
                    qty = min(abs(ask_vol), self.LIMIT - pos)
                    orders.append(Order("EMERALDS", ask_price, qty))
                    pos += qty
                    
        # Buy orders (Bids) that are overpriced -> We Sell to these!
        if len(order_depth.buy_orders) > 0:
            for bid_price, bid_vol in sorted(order_depth.buy_orders.items(), reverse=True):
                if bid_price > FV and pos > -self.LIMIT:
                    qty = min(abs(bid_vol), self.LIMIT + pos)
                    orders.append(Order("EMERALDS", bid_price, -qty))
                    pos -= qty

        # 2. Market Making: dynamically undercut the best bid/ask
        if len(order_depth.buy_orders) > 0 and len(order_depth.sell_orders) > 0:
            best_bid = max(order_depth.buy_orders.keys())
            best_ask = min(order_depth.sell_orders.keys())
            
            # Sit statically at a comfortable spread (wider than 1 tick) to avoid aggressively fighting bots
            # Targeting a 4 tick spread (FV-2, FV+2). Captures 2 points of profit per side.
            my_bid = FV - 2
            my_ask = FV + 2
            
            buy_capacity = self.LIMIT - pos
            sell_capacity = self.LIMIT + pos
            
            if buy_capacity > 0:
                orders.append(Order("EMERALDS", my_bid, buy_capacity))
            if sell_capacity > 0:
                orders.append(Order("EMERALDS", my_ask, -sell_capacity))

        return orders


    # ── TOMATOES STRATEGY ────────────────────────────────────────────────
    def trade_tomatoes(self, order_depth: OrderDepth, pos: int, current_ewma: Any) -> tuple[List[Order], Any]:
        orders: List[Order] = []
        
        if not order_depth.buy_orders or not order_depth.sell_orders:
            return orders, current_ewma
            
        # Extract Maximum Volume Levels ("Walls") for Theoretical Mid Price
        # Max volume on bids side (since volumes are positive)
        bid_wall_price = max(order_depth.buy_orders.keys(), key=lambda p: order_depth.buy_orders[p])
        
        # Max volume on asks side (since volumes are negative, `min` gives highest magnitude)
        ask_wall_price = min(order_depth.sell_orders.keys(), key=lambda p: order_depth.sell_orders[p])
        
        theo_mid = (bid_wall_price + ask_wall_price) / 2
        
        # Initialize EWMA if it's the very first tick 
        if current_ewma is None:
            new_ewma = theo_mid
        else:
            # Update EWMA formula
            new_ewma = self.TOMATOES_ALPHA * theo_mid + (1 - self.TOMATOES_ALPHA) * current_ewma
            
        # Extract best bid/ask to send actual orders
        best_bid = max(order_depth.buy_orders.keys())
        best_ask = min(order_depth.sell_orders.keys())
        
        diff = theo_mid - new_ewma
        buy_capacity = self.LIMIT - pos
        sell_capacity = self.LIMIT + pos
        
        # MOMENTUM STRATEGY: Trade WITH the Deviation (Ride the Trend)
        
        # If Theo Mid is significantly higher than EWMA -> Trend Upwards (Buy / Long)
        if diff > self.TOMATOES_SPREAD_THRESHOLD:
            if buy_capacity > 0:
                # TAKER order: Hit the best ask to cross the spread and buy into the momentum!
                orders.append(Order("TOMATOES", best_ask, buy_capacity))
                
        # If Theo Mid is significantly lower than EWMA -> Trend Downwards (Sell / Short)
        elif diff < -self.TOMATOES_SPREAD_THRESHOLD:
            if sell_capacity > 0:
                # TAKER order: Hit the best bid to cross the spread and sell into the crash!
                orders.append(Order("TOMATOES", best_bid, -sell_capacity))
                
        # The bot will hold the trend inventory until the momentum cleanly violently swings the other way.

        return orders, new_ewma