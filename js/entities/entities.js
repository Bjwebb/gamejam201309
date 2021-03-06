/*------------------- 
a player entity
-------------------------------- */
game.ModObjectEntity = me.ObjectEntity.extend({
                // Overload this so antigravity works properly
                computeVelocity : function(vel) {

			// apply gravity (if any)
			if (this.gravity) {
				// apply a constant gravity (if not on a ladder)
				vel.y += !this.onladder?(this.gravity * me.timer.tick):0;

				// check if falling / jumping
                                if (this.gravity > 0)
                                    this.falling = (vel.y > 0);
                                else
                                    this.falling = (vel.y < 0);
				this.jumping = this.falling?false:this.jumping;
			}

			// apply friction
			if (this.friction.x)
				vel.x = me.utils.applyFriction(vel.x,this.friction.x);
			if (this.friction.y)
				vel.y = me.utils.applyFriction(vel.y,this.friction.y);

			// cap velocity
			if (vel.y !== 0)
				vel.y = vel.y.clamp(-this.maxVel.y,this.maxVel.y);
			if (vel.x !== 0)
				vel.x = vel.x.clamp(-this.maxVel.x,this.maxVel.x);
		},
		updateMovement : function(collision /*FIXME*/) {

			this.computeVelocity(this.vel);

			// Adjust position only on collidable object
			var collision;
			if (this.collidable) {
				// check for collision
				//collision = this.collisionMap.checkCollision(this.collisionBox, this.vel);

				// update some flags
				this.onslope  = collision.yprop.isSlope || collision.xprop.isSlope;
				// clear the ladder flag
				this.onladder = false;



				// y collision
				if (collision.y) {
					// going down, collision with the floor
					this.onladder = collision.yprop.isLadder || collision.yprop.isTopLadder;

					if ((collision.y > 0 && this.gravity > 0) || (collision.y < 0 && this.gravity < 0)) {
						if (collision.yprop.isSolid	|| 
							(collision.yprop.isPlatform && (this.collisionBox.bottom - 1 <= collision.ytile.pos.y)) ||
							(collision.yprop.isTopLadder && !this.disableTopLadderCollision)) {
							// adjust position to the corresponding tile
							this.pos.y = ~~this.pos.y;
                                                        if (this.gravity > 0) {
                                                            this.vel.y = (this.falling) ?collision.ytile.pos.y - this.collisionBox.bottom: 0 ;
                                                        }else {
                                                            this.vel.y = (this.falling) ?collision.ytile.pos.y + 32 - this.collisionBox.top: 0 ;
                                                        }
							this.falling = false;
						}
						else if (collision.yprop.isSlope && !this.jumping) {
							// we stop falling
							this.checkSlope(collision.ytile, collision.yprop.isLeftSlope);
							this.falling = false;
						}
						else if (collision.yprop.isBreakable) {
							if  (this.canBreakTile) {
								// remove the tile
								me.game.currentLevel.clearTile(collision.ytile.col, collision.ytile.row);
								if (this.onTileBreak)
									this.onTileBreak();
							}
							else {
								// adjust position to the corresponding tile
								this.pos.y = ~~this.pos.y;
								this.vel.y = (this.falling) ?collision.ytile.pos.y - this.collisionBox.bottom: 0;
								this.falling = false;
							}
						}
					}
					// going up, collision with ceiling
					else if ((collision.y < 0 && this.gravity > 0) || (collision.y > 0 && this.gravity < 0)) {
						if (!collision.yprop.isPlatform	&& !collision.yprop.isLadder && !collision.yprop.isTopLadder) {
							this.falling = true;
							// cancel the y velocity
							this.vel.y = 0;
						}
					}
				}

				// x collision
				if (collision.x) {

					this.onladder = collision.xprop.isLadder || collision.yprop.isTopLadder;

					if (collision.xprop.isSlope && !this.jumping) {
						this.checkSlope(collision.xtile, collision.xprop.isLeftSlope);
						this.falling = false;
					} else {
						// can walk through the platform & ladder
						if (!collision.xprop.isPlatform && !collision.xprop.isLadder && !collision.xprop.isTopLadder) {
							if (collision.xprop.isBreakable	&& this.canBreakTile) {
								// remove the tile
								me.game.currentLevel.clearTile(collision.xtile.col, collision.xtile.row);
								if (this.onTileBreak) {
									this.onTileBreak();
								}
							} else if (collision.xprop.type != 'lowdeath') {
								this.vel.x = 0;
							}
						}
					}
				}
			}

			// update player position
			this.pos.add(this.vel);

			// returns the collision "vector"
			return collision;

		}
});

game.PlayerEntity = game.ModObjectEntity.extend({
    /* -----
 
    constructor
 
    ------ */

    init: function(x, y, settings) {
        // call the constructor
        this.parent(x, y, settings);
 
        // set the default horizontal & vertical speed (accel vector)
        this.setVelocity(3, 15);
        
        if (settings.grav == 1) {
            this.gravity = 0.2;
            var tw = 0;
        }
        if (settings.grav == -1) {
            this.gravity = -0.2;
            var tw = 40;
        }
        this.renderable.addAnimation("stay", [tw+14,tw+15], 20);
        this.renderable.addAnimation("walk", [tw+14,tw+15,tw+16,tw+15], 8);
        this.renderable.setCurrentAnimation("stay");

        this.updateColRect(10, 12, 0, 32);

        // set the display to follow our position on both axis
        //me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH);

        this.maxVel.y = 10;
    },
 
    /* -----
 
    update the player pos
 
    ------ */
    update: function() {
 
        if (me.input.isKeyPressed('left')) {
            // flip the sprite on horizontal axis
            // this.flipX(true);
            // update the entity velocity
            this.vel.x -= this.accel.x * me.timer.tick;
        } else if (me.input.isKeyPressed('right')) {
            // unflip the sprite
            // this.flipX(false);
            // update the entity velocity
            this.vel.x += this.accel.x * me.timer.tick;
        } else {
            this.vel.x = 0;
        }
        if (me.input.isKeyPressed('jump')) {
            // make sure we are not already jumping or falling
            if (!this.jumping && !this.falling) {
                // set current vel to the maximum defined value
                // gravity will then do the rest
                if (this.gravity > 0)
                    this.vel.y = -this.maxVel.y * me.timer.tick;
                else 
                    this.vel.y = +this.maxVel.y * me.timer.tick;
                // set the jumping flag
                this.jumping = true;
            }
        }
        /*
        else {
            if (this.jumping) {
                this.jumping = false;
                this.falling = true;
                this.vel.y = 0;
            }
        }
        */
 
        // check & update player movement
        this.updateMovement();
 
        // update animation if necessary
        if (this.vel.x!=0 || this.vel.y!=0) {
            if (!this.renderable.isCurrentAnimation('walk')) this.renderable.setCurrentAnimation('walk');
        }
        else {
            if (!this.renderable.isCurrentAnimation('stay')) this.renderable.setCurrentAnimation('stay');
        }

        // update object animation
        this.parent();
        return true;
         
        // else inform the engine we did not perform
        // any update (e.g. position, animation)
        //return false;
    },
    
    updateMovement: function() {
        var collision;
        if (this.collidable) {
            this.computeVelocity(this.vel);
            collision = this.collisionMap.checkCollision(this.collisionBox, this.vel);
            var tile;
            if (collision.xprop.type == 'collectable') {
                tile = collision.xtile;
                me.game.currentLevel.getLayerByName("collision").clearTile(tile.col, tile.row);
                me.game.currentLevel.getLayerByName("Background").clearTile(tile.col, tile.row);
            }
            if (collision.xprop.type == 'exit') {
                tile = collision.xtile;
                // FIXME
                if (me.levelDirector.getCurrentLevelId() == "level1")
                    me.levelDirector.loadLevel("level2");
                else {
                    me.levelDirector.loadLevel("level1");
                    me.game.viewport.pos.y = 32;
                }
            }
            for (i=0; i<2; i++) {
                if (i==0) {
                    if(!collision.x) continue;
                    tile = collision.xtile;
                    prop = collision.xprop;
                } else {
                    if(!collision.y) continue;
                    tile = collision.ytile;
                    prop = collision.yprop;
                }
                if (prop.type == 'lowdeath') {
                    if(this.pos.y + 16 > tile.pos.y) {
                        me.levelDirector.reloadLevel();
                        // FIXME
                        if (me.levelDirector.getCurrentLevelId() == "level1") {
                        me.game.viewport.pos.y = 32;
                        }
                    }
                }
                if (prop.type == 'highdeath') {
                    if(this.pos.y - 16 < tile.pos.y) {
                        me.levelDirector.reloadLevel();
                        // FIXME
                        if (me.levelDirector.getCurrentLevelId() == "level1") {
                        me.game.viewport.pos.y = 32;
                        }
                    }
                }
            }
            this.parent(collision);
        }
        //var tw = 40;
            //console.log(tile.tileId == 18);
    }
 
});
