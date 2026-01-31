module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ✅ التعامل مع الاقتراحات التلقائية
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`❌ Error in autocomplete for ${interaction.commandName}:`, error);
      }
      return;
    }

    // ✅ التعامل مع تنفيذ الأوامر
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`❌ Error in command ${interaction.commandName}:`, error);

        const errorReply = {
          content: '❌ An error occurred while executing the command.',
          flags: 64
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply);
        } else {
          await interaction.reply(errorReply);
        }
      }
      return;
    }

    // ✅ التعامل مع الأزرار - بشكل عام
      if (interaction.isButton()) {
          console.log(`🔄 Button: ${interaction.customId}`);

        try {
          // 1. زر بدء التحقق من البانل
          if (interaction.customId === 'start_verification_panel') {
            //console.log(`🎮 Start verification panel button pressed`);

            const verifyCommand = client.commands.get('verify');
            if (verifyCommand?.startVerificationFromPanel) {
              await verifyCommand.startVerificationFromPanel(interaction);
              return;
            } else {
              console.log(`❌ Verify command not found or no startVerificationFromPanel method`);
            }
          }

          // 2. معالجة أزرار CAPTCHA الخاصة بـ verify
          else if (interaction.customId.startsWith('captcha_verify,')) {
            //console.log(`🔢 CAPTCHA button pressed: ${interaction.customId}`);

            const verifyCommand = client.commands.get('verify');
            if (verifyCommand?.captchaHandler) {
              await verifyCommand.captchaHandler(interaction);
              return;
            }
          }

          // 3. معالجة أزرار إدخال الرابط الخاص بالبانل
          else if (interaction.customId === 'verify_enter_link_panel') {
            //console.log(`🔗 Panel link button pressed`);

            const verifyCommand = client.commands.get('verify');
            if (verifyCommand?.buttonHandler) {
              await verifyCommand.buttonHandler(interaction);
              return;
            }
          }

          // 4. معالجة أزرار إدخال الرابط الخاص بالأمر (/verify me)
          else if (interaction.customId === 'verify_enter_link_cmd') {
            //console.log(`🔗 /verify me link button pressed`);

            const verifyCommand = client.commands.get('verify');
            if (verifyCommand?.buttonHandler) {
              await verifyCommand.buttonHandler(interaction);
              return;
            }
          }

          else if (interaction.customId === 'simple_start_verification' || 
                interaction.customId.startsWith('simple_verify_')) {
                console.log(`🔄 Simple verify button: ${interaction.customId}`);

                const verifySimpleCommand = client.commands.get('verifycode');
                if (verifySimpleCommand?.buttonHandler) {
                    await verifySimpleCommand.buttonHandler(interaction);
                    return;
                }
            }

              // 3. أزرار testerspanel فقط
              else if (interaction.customId.includes('tester_') || 
                      interaction.customId.startsWith('approve_') || 
                      interaction.customId.startsWith('reject_') ||
                      interaction.customId.startsWith('close_')) {
                  const testerspanelCommand = client.commands.get('testerspanel');
                  if (testerspanelCommand?.buttonHandler) {
                      await testerspanelCommand.buttonHandler(interaction);
                      return;
                  }
              }

              // 👇 قسم خاص لـ shop (المتجر العادي)
              else if (interaction.customId === 'shop_next_page' || 
                   interaction.customId === 'shop_prev_page' || 
                   interaction.customId.startsWith('buy_item_') || 
                   interaction.customId.startsWith('refund_')) {
                  console.log(`🛒 Shop button: ${interaction.customId}`);

                  const shopCommand = client.commands.get('shop');
                  if (shopCommand?.buttonHandler) {
                      await shopCommand.buttonHandler(interaction);
                      return;
                  }
              }

              // 👇 قسم خاص لـ shopedit (تعديل الإداريين)
              else if (interaction.customId.startsWith('shopedit_') || 
                   interaction.customId.startsWith('delete_item_') || 
                   interaction.customId.startsWith('edit_item_') || 
                   interaction.customId === 'add_item' ||
                   interaction.customId === 'prev_page' ||
                   interaction.customId === 'next_page') {
                  console.log(`✏️ ShopEdit button: ${interaction.customId}`);

                  const shopeditCommand = client.commands.get('shopedit');
                  if (shopeditCommand?.buttonHandler) {
                      await shopeditCommand.buttonHandler(interaction);
                      return;
                  }
              }

              // 👇 قسم خاص لـ open_crate_ (فتح الكرات)
              else if (interaction.customId.startsWith('open_crate_')) {
                  try {
                      console.log(`📦 Open crate button: ${interaction.customId}`);

                      const dropsCommand = client.commands.get('drops');
                      if (dropsCommand?.buttonHandler) {
                          await dropsCommand.buttonHandler(interaction);
                          return;
                      } else {
                          console.log('❌ Drops command not found or no buttonHandler');
                          await interaction.reply({ 
                              content: '❌ Cannot open crate right now.', 
                              ephemeral: true 
                          });
                          return;
                      }

                  } catch (error) {
                      console.error('Error in open_crate button:', error);

                      if (!interaction.replied && !interaction.deferred) {
                          await interaction.reply({
                              content: '❌ Error opening crate.',
                              ephemeral: true
                          });
                      }
                  }
                  return;
              }

                // 5. أزرار buff_accept و buff_reject (الجديدة)
                else if (interaction.customId === 'buff_accept' || interaction.customId === 'buff_reject') {
                    console.log(`✨ Buff button: ${interaction.customId} by ${interaction.user.tag}`);

                    const dropsCommand = client.commands.get('drops');
                    if (dropsCommand?.buttonHandler) {
                        await dropsCommand.buttonHandler(interaction);
                        return;
                    } else {
                        console.log(`❌ Drops command not found or no buttonHandler`);
                        await interaction.reply({ 
                            content: '❌ This button is no longer active.', 
                            flags: 64 
                        });
                        return;
                    }
                }

                  // 👇 قسم خاص لـ setwallpaper (الجديد)
                  else if (interaction.customId.startsWith('wallpaper_')) {
                      console.log(`🎨 Wallpaper button: ${interaction.customId}`);

                      const wallpaperCommand = client.commands.get('setwallpaper');
                      if (wallpaperCommand?.handleButtonInteraction) {
                          await wallpaperCommand.handleButtonInteraction(interaction);
                          return;
                      } else {
                          console.log('❌ Setwallpaper command not found or no handleButtonInteraction');
                          await interaction.reply({ 
                              content: '❌ Cannot process wallpaper request.', 
                              ephemeral: true 
                          });
                          return;
                      }
                  }

              else { // ← الآن else صحيحة
                for (const [commandName, command] of client.commands) {
                    if (command.buttonHandler) {
                        try {
                            await command.buttonHandler(interaction);
                            return;
                        } catch (error) {
                            continue;
                        }
                    }
                }
              }

              // إذا محدش عالج الزر
              await interaction.reply({
                  content: '❌ This button is not active anymore.',
                  ephemeral: true
              }).catch(() => {});

              return;

          } catch (error) {
              console.error(`❌ Error in button handler:`, error);

              try {
                  if (!interaction.replied && !interaction.deferred) {
                      await interaction.reply({
                          content: '❌ Error processing button click. Please try again.',
                          ephemeral: true
                      });
                  }
              } catch (replyError) {
                  console.error(`❌ Could not send error message:`, replyError);
              }
          }
      }

    // ✅ التعامل مع المودالات - بشكل عام
    // في ملف interactionCreate.js
    if (interaction.isModalSubmit()) {
      try {
        //console.log(`📝 Modal submitted: ${interaction.customId} by ${interaction.user.tag}`);

        // ابحث عن الأمر المناسب بناءً على customId
        let commandName = '';

        // 1. مودال التحقق من البانل
        if (interaction.customId === 'verify_modal_verify_enter_link_panel') {
          //console.log(`📋 Verify panel modal submitted`);

          const verifyCommand = client.commands.get('verify');
          if (verifyCommand?.modalHandler) {
            await verifyCommand.modalHandler(interaction);
            return;
          }
        }

        // 2. مودال التحقق من الأمر (/verify me)
        else if (interaction.customId === 'verify_modal_verify_enter_link_cmd') {
          //console.log(`📋 /verify me modal submitted`);

          const verifyCommand = client.commands.get('verify');
          if (verifyCommand?.modalHandler) {
            await verifyCommand.modalHandler(interaction);
            return;
          }
        }

        // 3. مودال طلب التستير الجديد
        else if (interaction.customId === 'tester_application_form') {
          //console.log(`📋 Tester application form submitted`);

          const testerspanelCommand = client.commands.get('testerspanel');
          if (testerspanelCommand?.modalHandler) {
            await testerspanelCommand.modalHandler(interaction);
            return;
          }
        }

        // 4. مودال سبب إغلاق السبريد
        else if (interaction.customId.startsWith('close_reason_modal_')) {
          //console.log(`📋 Thread close reason modal submitted`);

          const testerspanelCommand = client.commands.get('testerspanel');
          if (testerspanelCommand?.modalHandler) {
            await testerspanelCommand.modalHandler(interaction);
            return;
          }
        }

        else if (interaction.customId.startsWith('shop_')) {
            console.log(`🛒 Shop modal: ${interaction.customId}`);

            const shopCommand = client.commands.get('shopedit');
            if (shopCommand?.modalHandler) {
                await shopCommand.modalHandler(interaction);
                return;
            }
        }

        if (commandName) {
          const command = client.commands.get(commandName);
          if (command?.modalHandler) {
            await command.modalHandler(interaction);
            return;
          }
        }

        // البحث العام إذا لم نجد
        for (const [cmdName, command] of client.commands) {
          if (command.modalHandler) {
            try {
              await command.modalHandler(interaction);
              return;
            } catch (error) {
              continue;
            }
          }
        }

        // إذا مفيش معالج
        await interaction.reply({
          content: '❌ This form is no longer active.',
          ephemeral: true
        });

      } catch (error) {
        console.error(`❌ Error in modal handler for ${interaction.customId}:`, error);

        // رسالة خطأ مفصلة
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `❌ Error: ${error.message.substring(0, 100)}`,
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '❌ An error occurred while processing the form.',
            ephemeral: true
          });
        }
      }
      return;
    }

    // ✅ التعامل مع Select Menus - بشكل عام
    if (interaction.isStringSelectMenu()) {
      try {
        //console.log(`📋 Select menu: ${interaction.customId} by ${interaction.user.tag}`);

        // 1. معالجة Select Menu الخاص بالأوامر المختلفة
        if (interaction.customId === 'rates_select_menu') {
          console.log(`📊 Rates select menu pressed - Value: ${interaction.values[0]}`);

          const ratesCommand = client.commands.get('rates');
          if (ratesCommand?.selectMenuHandler) {
            await ratesCommand.selectMenuHandler(interaction);
            return;
          } else {
            console.log('❌ Rates command not found or no selectMenuHandler');
            await interaction.reply({ 
              content: '❌ Rates system is not available.', 
              ephemeral: true 
            });
            return;
          }
        }
        
        // 👇 أضف هذا الكود الجديد
        if (interaction.customId === 'buff_type_select') {
            console.log(`⚡ Buff select menu in modal: ${interaction.customId}`);

            const shopeditCommand = client.commands.get('shopedit');
            if (shopeditCommand?.selectMenuHandler) {
                await shopeditCommand.selectMenuHandler(interaction);
                return;
            }
        }

        // البحث في كل الأوامر عن معالج للـ select menus
        for (const [commandName, command] of client.commands) {
          if (command.selectMenuHandler) {
            try {
              await command.selectMenuHandler(interaction);
              return;
            } catch (error) {
              continue;
            }
          }
        }

        await interaction.reply({
          content: '❌ This list is no longer active.',
          ephemeral: true
        });

      } catch (error) {
        console.error(`❌ Error in select menu handler for ${interaction.customId}:`, error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while processing the list.',
            ephemeral: true
          });
        }
      }
      return;
    }

    // ✅ التعامل مع Context Menus
    if (interaction.isContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`❌ Error in context menu ${interaction.commandName}:`, error);

        const errorReply = {
          content: '❌ Something wrong happened.',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply);
        } else {
          await interaction.reply(errorReply);
        }
      }
      return;
    }
  }
};