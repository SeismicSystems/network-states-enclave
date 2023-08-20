export class Utils {
  /*
   * Call `await` on the return value of this function to block. 
   */
  static sleep(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
